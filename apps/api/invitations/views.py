import csv
import hashlib
import io
import re
from datetime import timedelta
from urllib.parse import urlencode, urlparse

from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ObjectDoesNotExist
from django.db import connection, transaction
from django.http import Http404, HttpResponse
from django.utils import timezone
from django.utils.crypto import constant_time_compare, get_random_string
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics.models import AnalyticsEvent
from common.models import AuditEvent
from common.notifications import enqueue_client_notification
from common.permissions import require_recent_staff_mfa
from invitations.models import Guest, Invitation, InvitationMedia
from invitations.preview import (
    guest_management_token_payload,
    preview_token_for,
    preview_token_is_valid,
    wishes_token_is_valid,
)
from invitations.selectors import public_invitations
from invitations.serializers import (
    BacksoundAssetSerializer,
    GuestAggregateSerializer,
    InvitationBacksoundSerializer,
    PublicGuestRSVPCreateSerializer,
    PublicInvitationSerializer,
    PublicInvitationWishesSerializer,
    PublicRSVPSerializer,
    StaffGuestLinkCreateSerializer,
    StaffGuestLinkImportSerializer,
    StaffGuestLinkSerializer,
    StaffInvitationOperationSerializer,
)
from media_library.models import MediaAsset
from media_library.services import ALLOWED_AUDIO_FORMATS, public_audio_payload
from orders.models import Order
from orders.permissions import IsStaffRole
from weather.services import weather_for_invitation


class CSVRenderer(BaseRenderer):
    media_type = "text/csv"
    format = "csv"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class InvitationDetailView(RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicInvitationSerializer
    lookup_field = "public_slug"

    def get_queryset(self):
        return public_invitations()


class InvitationPreviewDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, public_slug: str) -> Response:
        invitation = (
            Invitation.objects.filter(public_slug=public_slug, archived_at__isnull=True)
            .select_related("theme", "package")
            .prefetch_related("events__location", "media__asset", "theme__media__asset")
            .first()
        )
        token = request.query_params.get("token", "")
        if invitation is None or not preview_token_is_valid(invitation, token):
            raise Http404
        return Response(PublicInvitationSerializer(invitation, context={"request": request}).data)


class InvitationWeatherView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        responses=inline_serializer(
            name="InvitationWeather",
            fields={
                "status": serializers.CharField(),
                "reason": serializers.CharField(),
                "provider": serializers.CharField(),
                "attribution_url": serializers.URLField(),
                "updated_at": serializers.DateTimeField(allow_null=True),
                "location": serializers.JSONField(allow_null=True),
                "event": serializers.JSONField(allow_null=True),
                "selected": serializers.JSONField(allow_null=True),
                "forecast": serializers.ListField(child=serializers.JSONField()),
                "selections": serializers.ListField(child=serializers.JSONField()),
            },
        )
    )
    def get(self, request, public_slug: str) -> Response:
        token = request.query_params.get("token") or request.query_params.get("preview")
        if token:
            invitation = (
                Invitation.objects.filter(public_slug=public_slug, archived_at__isnull=True)
                .select_related("theme", "package")
                .prefetch_related("events__location", "media__asset", "theme__media__asset")
                .first()
            )
            if invitation is None or not preview_token_is_valid(invitation, token):
                raise Http404
            return Response(weather_for_invitation(invitation))

        invitation = public_invitations().filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        return Response(weather_for_invitation(invitation))


def _guest_matches_token(guest: Guest, token: str) -> bool:
    stored = guest.access_token_hash
    if stored.startswith(("pbkdf2_", "argon2", "bcrypt", "md5$")):
        return check_password(token, stored)
    return constant_time_compare(stored, token)


def _rsvp_retention_date(invitation: Invitation):
    latest_event = invitation.events.order_by("-starts_at").first()
    base = latest_event.starts_at if latest_event else timezone.now()
    return base + timedelta(days=365)


def _guest_aggregate_rows(invitation: Invitation | None = None) -> list[dict[str, object]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT wedding_id, total_invited, total_confirmed, total_declined
            FROM guest_aggregates_per_wedding
            """
        )
        rows = cursor.fetchall()

    wanted_id = invitation.id.hex if invitation else ""
    aggregates: list[dict[str, object]] = []
    for wedding_id, total_invited, total_confirmed, total_declined in rows:
        normalized_wedding_id = str(wedding_id).replace("-", "")
        if wanted_id and normalized_wedding_id != wanted_id:
            continue
        total = int(total_invited or 0)
        confirmed = int(total_confirmed or 0)
        declined = int(total_declined or 0)
        aggregates.append(
            {
                "wedding_id": str(invitation.id) if invitation else str(wedding_id),
                "total_invited": total,
                "total_confirmed": confirmed,
                "total_declined": declined,
                "response_rate": round(((confirmed + declined) / total) * 100, 2) if total else 0,
            }
        )
    return aggregates


def _guest_delivery_url(invitation: Invitation, token: str, request) -> str:
    query = {"guest": token}
    if invitation.status != Invitation.Status.PUBLISHED:
        query["preview"] = preview_token_for(invitation)
    path = f"/{invitation.default_locale}/i/{invitation.public_slug}?{urlencode(query)}"
    origin = request.headers.get("Origin", "").rstrip("/")
    if origin:
        return f"{origin}{path}"
    return request.build_absolute_uri(path)


def _guest_delivery_payload(invitation: Invitation, guest: Guest, request) -> dict[str, object]:
    token = str(guest.metadata.get("delivery_token", "")).strip()
    delivery_sent_at = guest.metadata.get("delivery_sent_at")
    return {
        "id": guest.id,
        "display_name": guest.display_name,
        "email": guest.email,
        "phone": guest.phone,
        "party_size": guest.party_size,
        "rsvp_status": guest.rsvp_status,
        "attendance_count": guest.attendance_count,
        "responded_at": guest.responded_at,
        "delivery_url": _guest_delivery_url(invitation, token, request) if token else None,
        "delivery_status": "sent" if delivery_sent_at else "not_sent",
        "delivery_sent_at": delivery_sent_at,
        "token_available": bool(token),
        "created_at": guest.created_at,
    }


def _guest_delivery_queryset(invitation: Invitation):
    return invitation.guests.filter(
        archived_at__isnull=True,
        anonymized_at__isnull=True,
    ).order_by("created_at")


def _guest_management_invitation(token: str) -> Invitation | None:
    payload = guest_management_token_payload(token)
    if payload is None:
        return None
    invitation_id, public_slug = payload
    return (
        Invitation.objects.filter(
            id=invitation_id,
            public_slug=public_slug,
            archived_at__isnull=True,
        )
        .select_related("theme", "package", "order")
        .prefetch_related("guests")
        .first()
    )


def _guest_management_detail_payload(
    invitation: Invitation, token: str, request
) -> dict[str, object]:
    guests = _guest_delivery_queryset(invitation)
    content = invitation.content if isinstance(invitation.content, dict) else {}
    sent_count = sum(1 for guest in guests if guest.metadata.get("delivery_sent_at"))
    return {
        "token": token,
        "invitation": {
            "public_slug": invitation.public_slug,
            "default_locale": invitation.default_locale,
            "status": invitation.status,
            "approval_status": invitation.approval_status,
            "couple_name": _invitation_couple_name(invitation),
            "theme_name": invitation.theme.slug,
            "theme_slug": invitation.theme.slug,
            "package_name": invitation.package.code if invitation.package_id else "",
            "package_code": invitation.package.code if invitation.package_id else "",
        },
        "rsvp": _guest_aggregate_rows(invitation)[0]
        if _guest_aggregate_rows(invitation)
        else {
            "wedding_id": str(invitation.id),
            "total_invited": 0,
            "total_confirmed": 0,
            "total_declined": 0,
            "response_rate": 0,
        },
        "delivery": {
            "total_guests": guests.count(),
            "sent_count": sent_count,
            "not_sent_count": max(guests.count() - sent_count, 0),
        },
        "client_note": content.get("guest_management_note", ""),
    }


def _invitation_wishes_payload(invitation: Invitation) -> dict[str, object]:
    guests = invitation.guests.filter(archived_at__isnull=True, anonymized_at__isnull=True)
    total_invited = guests.count()
    total_confirmed = guests.filter(rsvp_status=Guest.RSVPStatus.ACCEPTED).count()
    total_declined = guests.filter(rsvp_status=Guest.RSVPStatus.DECLINED).count()
    total_pending = guests.filter(rsvp_status=Guest.RSVPStatus.PENDING).count()
    response_rate = (
        round(((total_confirmed + total_declined) / total_invited) * 100, 1) if total_invited else 0
    )
    wishes = [
        {
            "display_name": guest.display_name,
            "rsvp_status": guest.rsvp_status,
            "attendance_count": guest.attendance_count,
            "wishes": guest.wishes,
            "responded_at": guest.responded_at,
        }
        for guest in guests.exclude(wishes="").order_by("-responded_at", "display_name")
    ]
    return PublicInvitationWishesSerializer(
        {
            "public_slug": invitation.public_slug,
            "couple_name": _invitation_couple_name(invitation),
            "total_invited": total_invited,
            "total_confirmed": total_confirmed,
            "total_declined": total_declined,
            "total_pending": total_pending,
            "response_rate": response_rate,
            "wishes": wishes,
        }
    ).data


def _rsvp_invitation_for_request(request, public_slug: str) -> Invitation | None:
    invitation = public_invitations().filter(public_slug=public_slug).first()
    if invitation is not None:
        return invitation

    preview_token = (
        request.data.get("preview")
        or request.data.get("preview_token")
        or request.query_params.get("preview")
        or ""
    )
    if not preview_token:
        return None

    invitation = (
        Invitation.objects.filter(public_slug=public_slug, archived_at__isnull=True)
        .select_related("theme", "package")
        .prefetch_related("events__location", "guests")
        .first()
    )
    if invitation is None or not preview_token_is_valid(invitation, preview_token):
        return None
    return invitation


def _invitation_couple_name(invitation: Invitation) -> str:
    content = invitation.content if isinstance(invitation.content, dict) else {}
    couple = content.get("couple") if isinstance(content.get("couple"), dict) else {}
    partner_one = (
        couple.get("partnerOne")
        or couple.get("partner_one")
        or getattr(getattr(invitation, "order", None), "client_name", "")
    )
    partner_two = couple.get("partnerTwo") or couple.get("partner_two") or ""
    if partner_one and partner_two:
        return f"{partner_one} & {partner_two}"
    return str(partner_one or partner_two or invitation.public_slug)


def _generate_guest_delivery_token() -> str:
    while True:
        token = get_random_string(40)
        if not Guest.objects.filter(access_token_hash=token).exists():
            return token


GUEST_IMPORT_TEMPLATE_HEADERS = ["name", "phone", "email", "party_size", "group", "note"]
GUEST_IMPORT_MAX_ROWS = 1000
GUEST_IMPORT_MAX_BYTES = 2 * 1024 * 1024
GUEST_IMPORT_ALLOWED_CONTENT_TYPES = {
    "application/csv",
    "application/vnd.ms-excel",
    "text/csv",
    "text/plain",
}
GUEST_IMPORT_ALLOWED_HEADERS = {
    "attendance",
    "catatan",
    "display_name",
    "e-mail",
    "email",
    "group",
    "grup",
    "jumlah",
    "kategori",
    "kuota",
    "name",
    "nama",
    "note",
    "party_size",
    "phone",
    "wa",
    "whatsapp",
}


def _csv_safe(value: object) -> str:
    text = "" if value is None else str(value)
    if text.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{text}"
    return text


def _normalize_import_text(value: object) -> str:
    return str(value or "").strip()


def _normalize_import_email(value: object) -> str:
    return _normalize_import_text(value).lower()


def _normalize_import_phone(value: object) -> str:
    text = _normalize_import_text(value)
    if not text:
        return ""
    cleaned = re.sub(r"[^\d+]", "", text)
    if cleaned.startswith("+"):
        digits = re.sub(r"\D", "", cleaned)
        return f"+{digits}" if digits else ""
    digits = re.sub(r"\D", "", cleaned)
    if digits.startswith("0") and len(digits) > 1:
        return f"+62{digits[1:]}"
    if digits.startswith("62"):
        return f"+{digits}"
    if digits.startswith("8"):
        return f"+62{digits}"
    return digits


def _normalize_import_name(value: object) -> str:
    return re.sub(r"\s+", " ", _normalize_import_text(value))


def _guest_token_for_delivery(guest: Guest) -> str:
    token = str(guest.metadata.get("delivery_token", "")).strip()
    if token:
        return token
    token = _generate_guest_delivery_token()
    guest.access_token_hash = token
    guest.metadata = {
        **guest.metadata,
        "delivery_token": token,
        "source": guest.metadata.get("source") or "staff_dashboard",
    }
    guest.save(update_fields=["access_token_hash", "metadata", "updated_at"])
    return token


def _guest_import_field(row: dict[str, str], *names: str) -> str:
    normalized = {key.strip().lower(): value for key, value in row.items() if key}
    for name in names:
        if name in normalized:
            return normalized[name]
    return ""


def _guest_lookup_maps(invitation: Invitation) -> dict[str, dict[str, Guest]]:
    guests = list(_guest_delivery_queryset(invitation))
    return {
        "phone": {guest.phone.strip(): guest for guest in guests if guest.phone.strip()},
        "email": {guest.email.strip().lower(): guest for guest in guests if guest.email.strip()},
        "name": {
            _normalize_import_name(guest.display_name).lower(): guest
            for guest in guests
            if guest.display_name.strip()
        },
    }


def _match_guest_from_maps(
    lookup_maps: dict[str, dict[str, Guest]], *, phone: str, email: str, name: str
) -> Guest | None:
    if phone and phone in lookup_maps["phone"]:
        return lookup_maps["phone"][phone]
    if email and email in lookup_maps["email"]:
        return lookup_maps["email"][email]
    name_key = name.lower()
    if name_key and name_key in lookup_maps["name"]:
        return lookup_maps["name"][name_key]
    return None


def _parse_guest_import_upload(uploaded_file) -> list[dict[str, object]]:
    if uploaded_file.size > GUEST_IMPORT_MAX_BYTES:
        raise ValidationError({"file": "Ukuran CSV maksimal 2 MB."})
    content_type = str(getattr(uploaded_file, "content_type", "") or "").lower()
    if content_type and content_type not in GUEST_IMPORT_ALLOWED_CONTENT_TYPES:
        raise ValidationError({"file": "Tipe file tidak dikenali sebagai CSV."})
    try:
        raw = uploaded_file.read().decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationError({"file": "CSV harus memakai encoding UTF-8."}) from exc

    reader = csv.DictReader(io.StringIO(raw))
    if not reader.fieldnames:
        raise ValidationError({"file": "CSV kosong atau header tidak ditemukan."})
    normalized_headers = {str(header).strip().lower() for header in reader.fieldnames if header}
    unknown_headers = sorted(normalized_headers - GUEST_IMPORT_ALLOWED_HEADERS)
    if unknown_headers:
        raise ValidationError({"file": f"Kolom CSV tidak didukung: {', '.join(unknown_headers)}."})

    rows: list[dict[str, object]] = []
    seen_keys: set[str] = set()
    for index, row in enumerate(reader, start=2):
        if len(rows) >= GUEST_IMPORT_MAX_ROWS:
            raise ValidationError({"file": f"Maksimal {GUEST_IMPORT_MAX_ROWS} tamu per import."})

        name = _normalize_import_name(_guest_import_field(row, "name", "nama", "display_name"))
        phone = _normalize_import_phone(_guest_import_field(row, "phone", "whatsapp", "wa"))
        email = _normalize_import_email(_guest_import_field(row, "email", "e-mail"))
        group = _normalize_import_text(_guest_import_field(row, "group", "grup", "kategori"))
        note = _normalize_import_text(_guest_import_field(row, "note", "catatan"))
        party_size_raw = _normalize_import_text(
            _guest_import_field(row, "party_size", "jumlah", "kuota", "attendance")
        )
        errors: list[str] = []
        warnings: list[str] = []

        if not name:
            errors.append("Nama tamu wajib diisi.")

        try:
            party_size = int(party_size_raw or "1")
        except ValueError:
            party_size = 1
            errors.append("Party size harus angka.")
        if party_size < 1 or party_size > 20:
            errors.append("Party size harus di antara 1 dan 20.")

        if not phone and not email:
            warnings.append(
                "Phone/email kosong; link tetap dibuat, tapi delivery perlu disalin manual."
            )
        if email and "@" not in email:
            errors.append("Format email tidak valid.")

        dedupe_key = phone or email or name.lower()
        if dedupe_key in seen_keys:
            warnings.append("Baris terindikasi duplikat di file import.")
        seen_keys.add(dedupe_key)

        rows.append(
            {
                "row_number": index,
                "name": name,
                "phone": phone,
                "email": email,
                "party_size": party_size,
                "group": group,
                "note": note,
                "errors": errors,
                "warnings": warnings,
            }
        )
    return rows


def _guest_import_payload(
    *,
    invitation: Invitation,
    rows: list[dict[str, object]],
    request,
    commit: bool,
) -> dict[str, object]:
    lookup_maps = _guest_lookup_maps(invitation)
    result_rows: list[dict[str, object]] = []
    summary = {
        "total_rows": len(rows),
        "valid_rows": 0,
        "error_rows": 0,
        "warning_rows": 0,
        "created_count": 0,
        "updated_count": 0,
        "skipped_count": 0,
    }

    for row in rows:
        errors = list(row["errors"])
        warnings = list(row["warnings"])
        name = str(row["name"])
        phone = str(row["phone"])
        email = str(row["email"])
        matched_guest = _match_guest_from_maps(lookup_maps, phone=phone, email=email, name=name)
        action = "update" if matched_guest else "create"
        status = "ready"
        delivery_url = None

        if errors:
            status = "error"
            action = "skip"
            summary["error_rows"] += 1
            summary["skipped_count"] += 1
        else:
            summary["valid_rows"] += 1
            if warnings:
                summary["warning_rows"] += 1
            if matched_guest:
                summary["updated_count"] += 1
            else:
                summary["created_count"] += 1

            if commit:
                metadata = {
                    "delivery_token": "",
                    "source": "staff_dashboard_csv_import",
                    "import_group": row["group"],
                    "import_note": row["note"],
                    "imported_at": timezone.now().isoformat(),
                }
                if matched_guest:
                    metadata["delivery_token"] = str(
                        matched_guest.metadata.get("delivery_token", "")
                    ).strip()
                    matched_guest.display_name = name
                    matched_guest.email = email
                    matched_guest.phone = phone
                    matched_guest.party_size = int(row["party_size"])
                    matched_guest.metadata = {**matched_guest.metadata, **metadata}
                    matched_guest.save(
                        update_fields=[
                            "display_name",
                            "email",
                            "phone",
                            "party_size",
                            "metadata",
                            "updated_at",
                        ]
                    )
                    token = _guest_token_for_delivery(matched_guest)
                    delivery_url = _guest_delivery_url(invitation, token, request)
                else:
                    token = _generate_guest_delivery_token()
                    metadata["delivery_token"] = token
                    matched_guest = Guest.objects.create(
                        invitation=invitation,
                        access_token_hash=token,
                        display_name=name,
                        email=email,
                        phone=phone,
                        party_size=int(row["party_size"]),
                        metadata=metadata,
                    )
                    delivery_url = _guest_delivery_url(invitation, token, request)

                    lookup_maps["name"][_normalize_import_name(name).lower()] = matched_guest
                    if phone:
                        lookup_maps["phone"][phone] = matched_guest
                    if email:
                        lookup_maps["email"][email] = matched_guest
            elif matched_guest:
                token = str(matched_guest.metadata.get("delivery_token", "")).strip()
                delivery_url = _guest_delivery_url(invitation, token, request) if token else None

        result_rows.append(
            {
                "row_number": row["row_number"],
                "name": name,
                "phone": phone,
                "email": email,
                "party_size": row["party_size"],
                "group": row["group"],
                "note": row["note"],
                "status": status,
                "action": action,
                "errors": errors,
                "warnings": warnings,
                "matched_guest_id": matched_guest.id if matched_guest else None,
                "delivery_url": delivery_url,
            }
        )

    return {"summary": summary, "rows": result_rows}


def _invitation_client_recipient(invitation: Invitation):
    if invitation.client_user_id:
        return invitation.client_user
    try:
        return invitation.order.client_user
    except ObjectDoesNotExist:
        return None


def _audio_format_from_url(secure_url: str) -> str:
    extension = urlparse(secure_url).path.rsplit(".", 1)[-1].lower()
    return extension if extension in ALLOWED_AUDIO_FORMATS else ""


def _create_or_get_audio_asset(*, secure_url: str, title: str, resource_type: str) -> MediaAsset:
    format_name = _audio_format_from_url(secure_url)
    public_id_hash = hashlib.sha256(secure_url.encode("utf-8")).hexdigest()[:24]
    public_id = f"manual-audio/{public_id_hash}"
    asset, _created = MediaAsset.objects.get_or_create(
        public_id=public_id,
        defaults={
            "resource_type": resource_type,
            "format": format_name,
            "secure_url": secure_url,
            "folder": "wedding/invitations",
            "original_filename": title[:255],
            "checksum": public_id_hash,
        },
    )
    return asset


def _available_audio_assets():
    return MediaAsset.objects.filter(
        archived_at__isnull=True,
        format__in=sorted(ALLOWED_AUDIO_FORMATS),
        resource_type__in=[
            MediaAsset.ResourceType.RAW,
            MediaAsset.ResourceType.VIDEO,
        ],
    )


def _backsound_response(invitation: Invitation) -> dict[str, object]:
    backsound = (
        invitation.media.select_related("asset")
        .filter(role=InvitationMedia.Role.BACKSOUND, asset__archived_at__isnull=True)
        .order_by("sort_order", "created_at")
        .first()
    )
    return {
        "current": InvitationBacksoundSerializer(backsound).data if backsound else None,
        "available_assets": BacksoundAssetSerializer(
            _available_audio_assets()[:25],
            many=True,
        ).data,
    }


def _set_invitation_backsound(
    *,
    invitation: Invitation,
    actor,
    asset: MediaAsset | None,
) -> dict[str, object]:
    InvitationMedia.objects.filter(
        invitation=invitation,
        role=InvitationMedia.Role.BACKSOUND,
    ).delete()
    if asset is not None:
        InvitationMedia.objects.create(
            invitation=invitation,
            asset=asset,
            role=InvitationMedia.Role.BACKSOUND,
            sort_order=0,
        )
    AuditEvent.objects.create(
        actor=actor,
        action="invitation.backsound_updated",
        resource_type="invitation",
        resource_reference=invitation.public_slug,
        metadata={"asset_id": str(asset.id) if asset else None},
    )
    if getattr(actor, "role", "") == "staff":
        enqueue_client_notification(
            recipient=_invitation_client_recipient(invitation),
            event_type="invitation.backsound_updated",
            payload={
                "invitation": invitation.public_slug,
                "asset_id": str(asset.id) if asset else None,
            },
        )
    return _backsound_response(invitation)


def _transition_order_status(
    *,
    invitation: Invitation,
    status: str,
    actor,
    action: str = "order.status_changed",
) -> None:
    order = getattr(invitation, "order", None)
    if order is None or order.status == status:
        return

    old_status = order.status
    order.status = status
    order.save(update_fields=["status", "updated_at"])
    AuditEvent.objects.create(
        actor=actor,
        action=action,
        resource_type="order",
        resource_reference=order.reference,
        metadata={
            "old_status": old_status,
            "status": order.status,
            "invitation": invitation.public_slug,
        },
    )
    if getattr(actor, "role", "") == "staff":
        enqueue_client_notification(
            recipient=order.client_user or invitation.client_user,
            event_type=action,
            payload={
                "order": order.reference,
                "old_status": old_status,
                "status": order.status,
                "invitation": invitation.public_slug,
            },
        )


def _asset_from_music_payload(data) -> MediaAsset | None:
    asset_id = data.get("asset_id")
    secure_url = str(data.get("secure_url", "")).strip()
    if asset_id:
        asset = MediaAsset.objects.filter(id=asset_id, archived_at__isnull=True).first()
        if asset is None or public_audio_payload(asset) is None:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"asset_id": "Selected asset is not valid public audio."})
        return asset
    if not secure_url:
        return None

    resource_type = data.get("resource_type") or MediaAsset.ResourceType.RAW
    parsed = urlparse(secure_url)
    format_name = _audio_format_from_url(secure_url)
    if (
        parsed.scheme != "https"
        or (parsed.hostname or "").lower() != "res.cloudinary.com"
        or not format_name
        or resource_type not in {MediaAsset.ResourceType.RAW, MediaAsset.ResourceType.VIDEO}
    ):
        from rest_framework.exceptions import ValidationError

        raise ValidationError(
            {
                "secure_url": (
                    "Backsound must be a Cloudinary https audio URL with mp3, "
                    "m4a, aac, ogg, or wav format."
                )
            }
        )
    title = str(data.get("title", "")).strip() or "Background music"
    asset = _create_or_get_audio_asset(
        secure_url=secure_url,
        title=title,
        resource_type=resource_type,
    )
    if public_audio_payload(asset) is None:
        from rest_framework.exceptions import ValidationError

        raise ValidationError(
            {
                "secure_url": (
                    "Backsound must be a Cloudinary https audio URL with mp3, "
                    "m4a, aac, ogg, or wav format."
                )
            }
        )
    return asset


class InvitationRSVPView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "rsvp"

    def post(self, request, public_slug: str) -> Response:
        invitation = _rsvp_invitation_for_request(request, public_slug)
        if invitation is None:
            raise Http404
        serializer = PublicRSVPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]
        guest = next(
            (item for item in invitation.guests.all() if _guest_matches_token(item, token)),
            None,
        )
        if guest is None or guest.archived_at is not None or guest.anonymized_at is not None:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Invalid RSVP token.")
        attendance_count = serializer.validated_data["attendance_count"]
        if attendance_count > guest.party_size:
            from rest_framework.exceptions import ValidationError

            raise ValidationError(
                {
                    "attendance_count": (
                        f"Jumlah hadir melebihi kuota link tamu ({guest.party_size})."
                    )
                }
            )

        guest.rsvp_status = serializer.validated_data["rsvp_status"]
        guest.attendance_count = attendance_count
        guest.wishes = serializer.validated_data.get("wishes", "")
        guest.responded_at = timezone.now()
        guest.retention_expires_at = _rsvp_retention_date(invitation)
        guest.save(
            update_fields=[
                "rsvp_status",
                "attendance_count",
                "wishes",
                "responded_at",
                "retention_expires_at",
                "updated_at",
            ]
        )
        AnalyticsEvent.objects.create(
            event_type=AnalyticsEvent.EventType.RSVP_SUBMITTED,
            resource_type="invitation",
            resource_reference=invitation.public_slug,
            invitation=invitation,
            locale=invitation.default_locale,
        )
        return Response(
            {
                "status": guest.rsvp_status,
                "attendance_count": guest.attendance_count,
                "retention_expires_at": guest.retention_expires_at,
            }
        )


class PublicGuestRSVPCreateView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "rsvp"

    def post(self, request, public_slug: str) -> Response:
        invitation = public_invitations().filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        serializer = PublicGuestRSVPCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contact = serializer.validated_data.get("contact", "")
        guest = Guest.objects.create(
            invitation=invitation,
            access_token_hash=make_password(get_random_string(40)),
            display_name=serializer.validated_data["name"],
            email=contact if "@" in contact else "",
            phone="" if "@" in contact else contact,
            party_size=max(serializer.validated_data["attendance_count"], 1),
            rsvp_status=serializer.validated_data["rsvp_status"],
            attendance_count=serializer.validated_data["attendance_count"],
            wishes=serializer.validated_data.get("message", ""),
            responded_at=timezone.now(),
            retention_expires_at=_rsvp_retention_date(invitation),
        )
        AnalyticsEvent.objects.create(
            event_type=AnalyticsEvent.EventType.RSVP_SUBMITTED,
            resource_type="invitation",
            resource_reference=invitation.public_slug,
            invitation=invitation,
            locale=invitation.default_locale,
        )
        return Response({"status": guest.rsvp_status}, status=201)


class PublicInvitationWishesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, public_slug: str) -> Response:
        invitation = (
            Invitation.objects.filter(public_slug=public_slug, archived_at__isnull=True)
            .select_related("theme", "package")
            .prefetch_related("guests")
            .first()
        )
        access_token = request.query_params.get("access", "")
        if invitation is None or not wishes_token_is_valid(invitation, access_token):
            raise Http404

        return Response(_invitation_wishes_payload(invitation))


class StaffInvitationOperationListView(ListAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = StaffInvitationOperationSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = Invitation.objects.select_related(
            "theme",
            "package",
            "client_user",
            "order",
        )
        state = self.request.query_params.get("state")
        if state == "pending_publish":
            queryset = queryset.filter(
                approval_status=Invitation.ApprovalStatus.APPROVED_FOR_PUBLISH
            ).exclude(status=Invitation.Status.PUBLISHED)
        elif state == "published":
            queryset = queryset.filter(
                status=Invitation.Status.PUBLISHED,
                approval_status=Invitation.ApprovalStatus.PUBLISHED,
            )
        return queryset


class StaffInvitationPublishView(APIView):
    permission_classes = [IsStaffRole]

    def post(self, request, public_slug: str) -> Response:
        require_recent_staff_mfa(request)
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        if (
            invitation.status == Invitation.Status.PUBLISHED
            and invitation.approval_status == Invitation.ApprovalStatus.PUBLISHED
        ):
            return Response(
                {"status": invitation.status, "approval_status": invitation.approval_status}
            )
        if invitation.approval_status != Invitation.ApprovalStatus.APPROVED_FOR_PUBLISH:
            raise ValidationError(
                {"approval_status": "Invitation must be approved before publication."}
            )
        invitation.status = Invitation.Status.PUBLISHED
        invitation.approval_status = Invitation.ApprovalStatus.PUBLISHED
        invitation.published_at = timezone.now()
        invitation.save(update_fields=["status", "approval_status", "published_at", "updated_at"])
        _transition_order_status(
            invitation=invitation,
            status=Order.Status.PUBLISHED,
            actor=request.user,
        )
        AuditEvent.objects.create(
            actor=request.user,
            action="invitation.published",
            resource_type="invitation",
            resource_reference=invitation.public_slug,
        )
        enqueue_client_notification(
            recipient=_invitation_client_recipient(invitation),
            event_type="invitation.published",
            payload={"invitation": invitation.public_slug},
        )
        return Response(
            {"status": invitation.status, "approval_status": invitation.approval_status}
        )


class StaffInvitationGuestListCreateView(APIView):
    permission_classes = [IsStaffRole]

    def get(self, request, public_slug: str) -> Response:
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        aggregate = _guest_aggregate_rows(invitation)
        if not aggregate:
            aggregate = [
                {
                    "wedding_id": str(invitation.id),
                    "total_invited": 0,
                    "total_confirmed": 0,
                    "total_declined": 0,
                    "response_rate": 0,
                }
            ]
        return Response(GuestAggregateSerializer(aggregate[0]).data)

    def post(self, request, public_slug: str) -> Response:
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Staff can only access guest aggregates.")


class StaffInvitationGuestLinkListCreateView(APIView):
    permission_classes = [IsStaffRole]

    def get(self, request, public_slug: str) -> Response:
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        guests = _guest_delivery_queryset(invitation)
        payload = [_guest_delivery_payload(invitation, guest, request) for guest in guests]
        return Response(StaffGuestLinkSerializer(payload, many=True).data)

    def post(self, request, public_slug: str) -> Response:
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        serializer = StaffGuestLinkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = _generate_guest_delivery_token()
        guest = Guest.objects.create(
            invitation=invitation,
            access_token_hash=token,
            display_name=serializer.validated_data["display_name"],
            email=serializer.validated_data.get("email", ""),
            phone=serializer.validated_data.get("phone", ""),
            party_size=serializer.validated_data["party_size"],
            metadata={"delivery_token": token, "source": "staff_dashboard"},
        )
        AuditEvent.objects.create(
            actor=request.user,
            action="guest.delivery_link_created",
            resource_type="invitation",
            resource_reference=invitation.public_slug,
            metadata={
                "guest_id": str(guest.id),
                "source": "staff_dashboard",
            },
        )
        payload = _guest_delivery_payload(invitation, guest, request)
        return Response(StaffGuestLinkSerializer(payload).data, status=201)


class StaffInvitationGuestLinkImportTemplateView(APIView):
    permission_classes = [IsStaffRole]
    renderer_classes = [CSVRenderer, JSONRenderer]

    def get(self, request, public_slug: str) -> HttpResponse:
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="{invitation.public_slug}-guest-import-template.csv"'
        )
        writer = csv.writer(response)
        writer.writerow(GUEST_IMPORT_TEMPLATE_HEADERS)
        writer.writerow(["Syarif", "+628123456789", "syarif@example.com", "2", "Teman", "VIP"])
        return response


class StaffInvitationGuestLinkImportView(APIView):
    permission_classes = [IsStaffRole]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "guest_import"

    def post(self, request, public_slug: str) -> Response:
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        uploaded_file = request.FILES.get("file")
        if uploaded_file is None:
            raise ValidationError({"file": "Upload file CSV wajib disertakan."})
        if not uploaded_file.name.lower().endswith(".csv"):
            raise ValidationError({"file": "Untuk v1, import hanya menerima file .csv."})

        rows = _parse_guest_import_upload(uploaded_file)
        dry_run = request.query_params.get("dry_run", "").lower() in {"1", "true", "yes"}
        if dry_run:
            payload = _guest_import_payload(
                invitation=invitation,
                rows=rows,
                request=request,
                commit=False,
            )
            return Response(StaffGuestLinkImportSerializer(payload).data)

        with transaction.atomic():
            payload = _guest_import_payload(
                invitation=invitation,
                rows=rows,
                request=request,
                commit=True,
            )
            AuditEvent.objects.create(
                actor=request.user,
                action="guest.delivery_links_imported",
                resource_type="invitation",
                resource_reference=invitation.public_slug,
                metadata={
                    "total_rows": payload["summary"]["total_rows"],
                    "valid_rows": payload["summary"]["valid_rows"],
                    "error_rows": payload["summary"]["error_rows"],
                    "created_count": payload["summary"]["created_count"],
                    "updated_count": payload["summary"]["updated_count"],
                    "source": "staff_dashboard_csv_import",
                },
            )
        return Response(StaffGuestLinkImportSerializer(payload).data)


class StaffInvitationGuestLinkExportView(APIView):
    permission_classes = [IsStaffRole]
    renderer_classes = [CSVRenderer, JSONRenderer]

    def get(self, request, public_slug: str) -> HttpResponse:
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="{invitation.public_slug}-guest-links.csv"'
        )
        writer = csv.writer(response)
        writer.writerow(
            [
                "name",
                "email",
                "phone",
                "party_size",
                "rsvp_status",
                "attendance_count",
                "delivery_url",
            ]
        )
        for guest in _guest_delivery_queryset(invitation):
            payload = _guest_delivery_payload(invitation, guest, request)
            writer.writerow(
                [
                    _csv_safe(payload["display_name"]),
                    _csv_safe(payload["email"]),
                    _csv_safe(payload["phone"]),
                    payload["party_size"],
                    _csv_safe(payload["rsvp_status"]),
                    payload["attendance_count"],
                    _csv_safe(payload["delivery_url"] or ""),
                ]
            )
        return response


class GuestManagementDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token: str) -> Response:
        invitation = _guest_management_invitation(token)
        if invitation is None:
            raise Http404
        return Response(_guest_management_detail_payload(invitation, token, request))


class GuestManagementWishesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token: str) -> Response:
        invitation = _guest_management_invitation(token)
        if invitation is None:
            raise Http404
        return Response(_invitation_wishes_payload(invitation))


class GuestManagementGuestLinkListCreateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token: str) -> Response:
        invitation = _guest_management_invitation(token)
        if invitation is None:
            raise Http404
        guests = _guest_delivery_queryset(invitation)
        query = str(request.query_params.get("q", "")).strip().lower()
        if query:
            guests = guests.filter(display_name__icontains=query)
        payload = [_guest_delivery_payload(invitation, guest, request) for guest in guests]
        return Response(StaffGuestLinkSerializer(payload, many=True).data)

    def post(self, request, token: str) -> Response:
        invitation = _guest_management_invitation(token)
        if invitation is None:
            raise Http404
        serializer = StaffGuestLinkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        guest_token = _generate_guest_delivery_token()
        guest = Guest.objects.create(
            invitation=invitation,
            access_token_hash=guest_token,
            display_name=serializer.validated_data["display_name"],
            email=serializer.validated_data.get("email", ""),
            phone=serializer.validated_data.get("phone", ""),
            party_size=serializer.validated_data["party_size"],
            metadata={"delivery_token": guest_token, "source": "client_guest_management"},
        )
        AuditEvent.objects.create(
            actor=None,
            action="guest.delivery_link_created_by_client",
            resource_type="invitation",
            resource_reference=invitation.public_slug,
            metadata={
                "guest_id": str(guest.id),
                "source": "client_guest_management",
            },
        )
        payload = _guest_delivery_payload(invitation, guest, request)
        return Response(StaffGuestLinkSerializer(payload).data, status=201)


class GuestManagementGuestLinkImportTemplateView(APIView):
    permission_classes = [AllowAny]
    renderer_classes = [CSVRenderer, JSONRenderer]

    def get(self, request, token: str) -> HttpResponse:
        invitation = _guest_management_invitation(token)
        if invitation is None:
            raise Http404
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="{invitation.public_slug}-template-daftar-tamu.csv"'
        )
        writer = csv.writer(response)
        writer.writerow(GUEST_IMPORT_TEMPLATE_HEADERS)
        writer.writerow(
            ["Syarif dan Istri", "+628123456789", "syarif@example.com", "2", "Keluarga", ""]
        )
        writer.writerow(["Rara", "+628987654321", "", "1", "Teman", ""])
        return response


class GuestManagementGuestLinkImportView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "guest_import"

    def post(self, request, token: str) -> Response:
        invitation = _guest_management_invitation(token)
        if invitation is None:
            raise Http404
        uploaded_file = request.FILES.get("file")
        if uploaded_file is None:
            raise ValidationError({"file": "Pilih file CSV daftar tamu terlebih dahulu."})
        if not uploaded_file.name.lower().endswith(".csv"):
            raise ValidationError({"file": "File harus berformat .csv."})

        rows = _parse_guest_import_upload(uploaded_file)
        dry_run = request.query_params.get("dry_run", "").lower() in {"1", "true", "yes"}
        if dry_run:
            payload = _guest_import_payload(
                invitation=invitation,
                rows=rows,
                request=request,
                commit=False,
            )
            return Response(StaffGuestLinkImportSerializer(payload).data)

        with transaction.atomic():
            payload = _guest_import_payload(
                invitation=invitation,
                rows=rows,
                request=request,
                commit=True,
            )
            AuditEvent.objects.create(
                actor=None,
                action="guest.delivery_links_imported_by_client",
                resource_type="invitation",
                resource_reference=invitation.public_slug,
                metadata={
                    "total_rows": payload["summary"]["total_rows"],
                    "valid_rows": payload["summary"]["valid_rows"],
                    "error_rows": payload["summary"]["error_rows"],
                    "created_count": payload["summary"]["created_count"],
                    "updated_count": payload["summary"]["updated_count"],
                    "source": "client_guest_management",
                },
            )
        return Response(StaffGuestLinkImportSerializer(payload).data)


class GuestManagementGuestLinkExportView(APIView):
    permission_classes = [AllowAny]
    renderer_classes = [CSVRenderer, JSONRenderer]

    def get(self, request, token: str) -> HttpResponse:
        invitation = _guest_management_invitation(token)
        if invitation is None:
            raise Http404
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="{invitation.public_slug}-daftar-link-tamu.csv"'
        )
        writer = csv.writer(response)
        writer.writerow(
            [
                "name",
                "email",
                "phone",
                "party_size",
                "rsvp_status",
                "attendance_count",
                "delivery_status",
                "delivery_url",
            ]
        )
        for guest in _guest_delivery_queryset(invitation):
            payload = _guest_delivery_payload(invitation, guest, request)
            writer.writerow(
                [
                    _csv_safe(payload["display_name"]),
                    _csv_safe(payload["email"]),
                    _csv_safe(payload["phone"]),
                    payload["party_size"],
                    _csv_safe(payload["rsvp_status"]),
                    payload["attendance_count"],
                    _csv_safe(payload["delivery_status"]),
                    _csv_safe(payload["delivery_url"] or ""),
                ]
            )
        return response


class GuestManagementGuestDeliveryStatusView(APIView):
    permission_classes = [AllowAny]

    def patch(self, request, token: str, guest_id) -> Response:
        invitation = _guest_management_invitation(token)
        if invitation is None:
            raise Http404
        guest = _guest_delivery_queryset(invitation).filter(id=guest_id).first()
        if guest is None:
            raise Http404

        sent = bool(request.data.get("sent"))
        metadata = {**guest.metadata}
        if sent:
            metadata["delivery_sent_at"] = timezone.now().isoformat()
        else:
            metadata.pop("delivery_sent_at", None)
        metadata["delivery_updated_at"] = timezone.now().isoformat()
        metadata["delivery_updated_by"] = "client_guest_management"
        guest.metadata = metadata
        guest.save(update_fields=["metadata", "updated_at"])
        AuditEvent.objects.create(
            actor=None,
            action="guest.delivery_status_updated_by_client",
            resource_type="invitation",
            resource_reference=invitation.public_slug,
            metadata={
                "guest_id": str(guest.id),
                "delivery_status": "sent" if sent else "not_sent",
            },
        )
        return Response(
            StaffGuestLinkSerializer(_guest_delivery_payload(invitation, guest, request)).data
        )


class StaffInvitationMusicView(APIView):
    permission_classes = [IsStaffRole]

    def get(self, request, public_slug: str) -> Response:
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        return Response(_backsound_response(invitation))

    def patch(self, request, public_slug: str) -> Response:
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        asset = _asset_from_music_payload(request.data)
        return Response(
            _set_invitation_backsound(
                invitation=invitation,
                actor=request.user,
                asset=asset,
            )
        )


class StaffGuestAnonymizeView(APIView):
    permission_classes = [IsStaffRole]

    def post(self, request, guest_id: str) -> Response:
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Staff can only access guest aggregates.")


class StaffGuestArchiveView(APIView):
    permission_classes = [IsStaffRole]

    def post(self, request, guest_id: str) -> Response:
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Staff can only access guest aggregates.")

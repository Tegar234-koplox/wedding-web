import csv
import hashlib
import re
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Max, Prefetch, Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from common.models import AuditEvent
from common.notifications import enqueue_client_notification
from common.permissions import require_recent_staff_mfa
from invitations.bespoke import (
    create_review_session,
    create_scope_agreement,
    ensure_bespoke_invitation,
    publish_invitation,
    update_bespoke_config,
)
from invitations.models import (
    ClientReviewSession,
    EventLocation,
    Invitation,
    InvitationMedia,
    InvitationRevision,
    WeddingEvent,
)
from leads.models import WhatsAppIntent
from media_library.models import MediaAsset
from orders.lifecycle import (
    archive_expired_wedding,
    invitation_client_recipient,
    staff_confirm_order,
    staff_reject_order,
)
from orders.models import BespokeChangeRequest, BespokeScopeAgreement, Order
from orders.permissions import IsStaffRole
from orders.serializers import (
    OrderSerializer,
    StaffClientLifecycleSerializer,
    StaffOrderDetailSerializer,
    StaffOrderRevisionCreateSerializer,
    StaffRejectOrderSerializer,
    StaffVerificationActionSerializer,
)


class StaffCSVRenderer(BaseRenderer):
    media_type = "text/csv"
    format = "csv"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return b""
        return str(data).encode(self.charset)


def _detail_queryset():
    return Order.objects.select_related(
        "theme",
        "package",
        "invitation",
        "invitation__theme",
        "invitation__package",
        "whatsapp_intent",
        "assigned_staff",
        "client_user",
    ).prefetch_related(
        Prefetch(
            "invitation__events",
            queryset=WeddingEvent.objects.select_related("location"),
        ),
        Prefetch(
            "invitation__media",
            queryset=InvitationMedia.objects.select_related("asset"),
        ),
        Prefetch(
            "invitation__revisions",
            queryset=InvitationRevision.objects.select_related("created_by"),
        ),
        "manual_payments",
    )


def _parse_staff_datetime(value: str):
    if not value:
        return None
    parsed = parse_datetime(value)
    if parsed is None:
        raise ValidationError({"starts_at": "Datetime is not valid."})
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _parse_coordinate(value, *, field: str, minimum: Decimal, maximum: Decimal) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        coordinate = Decimal(str(value)).quantize(Decimal("0.000001"))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError({field: "Coordinate is not valid."}) from exc
    if coordinate < minimum or coordinate > maximum:
        raise ValidationError({field: "Coordinate is out of range."})
    return coordinate


def _unique_invitation_slug(reference: str) -> str:
    base_slug = slugify(reference) or f"order-{timezone.now().timestamp():.0f}"
    slug = base_slug
    index = 2
    while Invitation.objects.filter(public_slug=slug).exists():
        slug = f"{base_slug}-{index}"
        index += 1
    return slug


def _next_order_reference() -> str:
    max_number = 0
    for reference in Order.objects.values_list("reference", flat=True):
        match = re.fullmatch(r"n(\d+)", reference, flags=re.IGNORECASE)
        if match:
            max_number = max(max_number, int(match.group(1)))
    return f"N{max_number + 1:03d}"


def _auto_order_reference(reference: str) -> bool:
    return bool(re.fullmatch(r"n\d+", reference.strip(), flags=re.IGNORECASE))


def _couple_from_client_name(client_name: str) -> dict[str, str]:
    name = client_name.strip()
    if not name:
        return {
            "partnerOne": "Nama Pasangan",
            "partnerTwo": "Nama Pasangan",
            "monogram": "N",
        }
    parts = [
        part.strip()
        for part in re.split(r"\s+(?:dan|and)\s+|\s*&\s*|\s*\+\s*", name, maxsplit=1, flags=re.I)
        if part.strip()
    ]
    partner_one = parts[0] if parts else name
    partner_two = parts[1] if len(parts) > 1 else "Nama Pasangan"
    monogram = "&".join(
        part[:1] for part in [partner_one, partner_two] if part and part != "Nama Pasangan"
    )
    return {
        "partnerOne": partner_one,
        "partnerTwo": partner_two,
        "monogram": monogram or partner_one[:1] or "N",
    }


def _sync_invitation_couple(invitation: Invitation, client_name: str) -> None:
    content = invitation.content if isinstance(invitation.content, dict) else {}
    content["couple"] = _couple_from_client_name(client_name)
    invitation.content = content
    invitation.save(update_fields=["content", "updated_at"])


def _ensure_invitation(order: Order) -> Invitation:
    if order.invitation_id:
        return order.invitation
    if order.theme_id is None:
        raise ValidationError({"theme_slug": "Theme is required before editing invitation data."})
    invitation = Invitation.objects.create(
        public_slug=_unique_invitation_slug(order.reference),
        theme=order.theme,
        package=order.package,
        renderer_key=order.theme.renderer_key,
        renderer_version=order.theme.renderer_version,
        content_schema_version=order.theme.content_schema_version,
        content={
            "couple": _couple_from_client_name(order.client_name),
            "opening": {
                "eyebrow": "Dengan penuh sukacita",
                "title": "Kami mengundang Anda",
                "message": "Untuk hadir di hari pernikahan kami.",
            },
            "event": {
                "dateLabel": "Tanggal acara",
                "ceremonyLabel": "Akad",
                "ceremonyTime": "Waktu akad",
                "receptionLabel": "Resepsi",
                "receptionTime": "Waktu resepsi",
                "venue": "Nama Venue",
                "address": "Alamat venue",
                "mapUrl": "https://maps.google.com",
            },
            "story": {
                "heading": "Cerita kami",
                "body": "Kami bertemu dan bertumbuh bersama.",
            },
            "quote": {
                "text": (
                    "Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan "
                    "pasangan-pasangan untukmu."
                ),
                "attribution": "Ar-Rum · 21",
            },
            "gallery": [
                {"src": "/images/one.webp", "alt": "Gallery 1"},
                {"src": "/images/two.webp", "alt": "Gallery 2"},
                {"src": "/images/three.webp", "alt": "Gallery 3"},
            ],
            "closing": {
                "heading": "Sampai bertemu",
                "message": "Terima kasih atas doa dan restunya.",
            },
        },
    )
    order.invitation = invitation
    order.save(update_fields=["invitation", "updated_at"])
    return invitation


def _publish_invitation_for_order(order: Order, actor) -> Invitation:
    invitation = _ensure_invitation(order)
    invitation = publish_invitation(invitation, actor=actor)
    AuditEvent.objects.create(
        actor=actor,
        action="invitation.published",
        resource_type="invitation",
        resource_reference=invitation.public_slug,
        metadata={"order": order.reference, "source": "staff_order_status"},
    )
    return invitation


def _update_event(invitation: Invitation, event_type: str, data: dict) -> None:
    if not isinstance(data, dict):
        return
    starts_at = _parse_staff_datetime(str(data.get("starts_at", "")).strip())
    event, _created = WeddingEvent.objects.get_or_create(
        invitation=invitation,
        event_type=event_type,
        defaults={
            "starts_at": starts_at or timezone.now(),
            "venue_name": str(data.get("venue_name", "")).strip() or "Belum diisi",
            "address": str(data.get("address", "")).strip() or "Belum diisi",
            "sort_order": 1 if event_type == WeddingEvent.EventType.CEREMONY else 2,
        },
    )
    update_fields: list[str] = []
    if starts_at is not None:
        event.starts_at = starts_at
        update_fields.append("starts_at")
    for field in ["venue_name", "address", "map_url"]:
        if field in data:
            setattr(event, field, str(data.get(field, "")).strip())
            update_fields.append(field)
    if update_fields:
        event.save(update_fields=[*sorted(set(update_fields)), "updated_at"])

    has_location_data = any(
        field in data
        for field in [
            "latitude",
            "longitude",
            "province",
            "regency",
            "district",
            "village",
        ]
    )
    if has_location_data:
        latitude = _parse_coordinate(
            data.get("latitude"),
            field="latitude",
            minimum=Decimal("-90"),
            maximum=Decimal("90"),
        )
        longitude = _parse_coordinate(
            data.get("longitude"),
            field="longitude",
            minimum=Decimal("-180"),
            maximum=Decimal("180"),
        )
        location, _created = EventLocation.objects.get_or_create(
            event=event,
            defaults={
                "province": str(data.get("province", "")).strip(),
                "regency": str(data.get("regency", "")).strip(),
                "district": str(data.get("district", "")).strip(),
                "village": str(data.get("village", "")).strip() or event.venue_name,
            },
        )
        location_fields: list[str] = []
        for field in ["province", "regency", "district", "village"]:
            if field in data:
                setattr(location, field, str(data.get(field, "")).strip())
                location_fields.append(field)
        if "latitude" in data:
            location.latitude = latitude
            location_fields.append("latitude")
        if "longitude" in data:
            location.longitude = longitude
            location_fields.append("longitude")
        if location_fields:
            location.save(update_fields=[*sorted(set(location_fields)), "updated_at"])


def _update_invitation_content(invitation: Invitation, data: dict) -> None:
    content = invitation.content if isinstance(invitation.content, dict) else {}
    changed = False
    if "story" in data:
        raw_story = data.get("story")
        if not isinstance(raw_story, dict):
            raise ValidationError({"story": "Story must be an object."})
        current_story = content.get("story") if isinstance(content.get("story"), dict) else {}
        heading = str(raw_story.get("heading", current_story.get("heading")) or "").strip()
        body = str(raw_story.get("body", current_story.get("body")) or "").strip()
        updated_story = {
            "heading": heading or "Cerita kami",
            "body": body or "Kami bertemu dan bertumbuh bersama.",
        }

        current_section_bodies = current_story.get("sectionBodies")
        section_bodies = (
            dict(current_section_bodies) if isinstance(current_section_bodies, dict) else {}
        )
        if "sectionBodies" in raw_story:
            raw_section_bodies = raw_story.get("sectionBodies")
            if not isinstance(raw_section_bodies, dict):
                raise ValidationError({"story.sectionBodies": "Section bodies must be an object."})
            allowed_sections = {"middle", "final", "conflict", "intimacy", "trust"}
            unsupported_sections = set(raw_section_bodies).difference(allowed_sections)
            if unsupported_sections:
                raise ValidationError(
                    {
                        "story.sectionBodies": (
                            "Unsupported section: "
                            f"{', '.join(sorted(str(key) for key in unsupported_sections))}."
                        )
                    }
                )
            section_bodies = {}
            for section, raw_value in raw_section_bodies.items():
                value = str(raw_value or "").strip()
                if not value:
                    continue
                if len(value) > 1200:
                    raise ValidationError(
                        {f"story.sectionBodies.{section}": "Must be 1200 characters or fewer."}
                    )
                section_bodies[section] = value
        if section_bodies:
            updated_story["sectionBodies"] = section_bodies
        content["story"] = updated_story
        changed = True
    if "quote" in data:
        raw_quote = data.get("quote")
        if not isinstance(raw_quote, dict):
            raise ValidationError({"quote": "Quote must be an object."})
        current_quote = content.get("quote") if isinstance(content.get("quote"), dict) else {}
        default_text = (
            "Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan "
            "pasangan-pasangan untukmu."
        )
        text = str(raw_quote.get("text", current_quote.get("text")) or "").strip()
        attribution = str(
            raw_quote.get("attribution", current_quote.get("attribution")) or ""
        ).strip()
        if len(text) > 500:
            raise ValidationError({"quote.text": "Must be 500 characters or fewer."})
        if len(attribution) > 120:
            raise ValidationError({"quote.attribution": "Must be 120 characters or fewer."})
        content["quote"] = {
            "text": text or default_text,
            "attribution": attribution or "Ar-Rum · 21",
        }
        changed = True
    if "timeline" in data:
        raw_timeline = data.get("timeline") if isinstance(data.get("timeline"), dict) else {}
        allowed_modes = {"opening", "middle", "final", "conflict", "intimacy", "trust"}
        timeline: dict[str, list[dict[str, str]]] = {}
        for mode, raw_entries in raw_timeline.items():
            if mode not in allowed_modes or not isinstance(raw_entries, list):
                continue
            entries = []
            for raw_entry in raw_entries:
                if not isinstance(raw_entry, dict):
                    continue
                number = str(raw_entry.get("number") or "").strip()[:8]
                title = str(raw_entry.get("title") or "").strip()[:120]
                description = str(raw_entry.get("description") or "").strip()[:700]
                if number and title and description:
                    entries.append(
                        {
                            "number": number,
                            "title": title,
                            "description": description,
                        }
                    )
            if entries:
                timeline[mode] = entries[:6]
        content["timeline"] = timeline
        changed = True
    if "bank_accounts" in data:
        content["bank_accounts"] = data.get("bank_accounts") or []
        changed = True
    if "rsvp_manual" in data:
        content["rsvp_manual"] = data.get("rsvp_manual") or {}
        changed = True
    if "gallery" in data:
        content["gallery"] = [
            {"src": url, "alt": f"Gallery {index + 1}"}
            for index, url in enumerate(str(item).strip() for item in data.get("gallery") or [])
            if url
        ]
        changed = True
    if changed:
        invitation.content = content
        invitation.save(update_fields=["content", "updated_at"])


def _asset_from_url(url: str, *, role: str) -> MediaAsset | None:
    secure_url = url.strip()
    if not secure_url:
        return None
    if not secure_url.startswith("https://res.cloudinary.com/"):
        raise ValidationError({role: "Media URL must be a Cloudinary https URL."})
    checksum = hashlib.sha256(secure_url.encode("utf-8")).hexdigest()
    public_id = f"manual-{role}/{checksum[:24]}"
    return MediaAsset.objects.get_or_create(
        public_id=public_id,
        defaults={
            "resource_type": (
                MediaAsset.ResourceType.RAW
                if role == InvitationMedia.Role.BACKSOUND
                else MediaAsset.ResourceType.IMAGE
            ),
            "format": secure_url.rsplit(".", 1)[-1][:16] if "." in secure_url else "",
            "secure_url": secure_url,
            "folder": "wedding/manual",
            "original_filename": role,
            "checksum": checksum,
        },
    )[0]


def _replace_media(invitation: Invitation, role: str, urls: list[str]) -> None:
    InvitationMedia.objects.filter(invitation=invitation, role=role).delete()
    for index, url in enumerate(urls):
        asset = _asset_from_url(url, role=role)
        if asset is None:
            continue
        InvitationMedia.objects.create(
            invitation=invitation,
            asset=asset,
            role=role,
            sort_order=index,
        )


def _update_photo_focal_point(invitation: Invitation, data: object) -> None:
    if not isinstance(data, dict):
        raise ValidationError({"photo_focal": "Photo focal point must be an object."})

    updates: dict[str, Decimal] = {}
    for field in ["focal_x", "focal_y"]:
        if field not in data:
            continue
        value = data.get(field)
        try:
            focal_value = Decimal(str(value)).quantize(Decimal("0.01"))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise ValidationError(
                {f"photo_focal.{field}": "Focal point must be a number from 0 to 100."}
            ) from exc
        if focal_value < 0 or focal_value > 100:
            raise ValidationError(
                {f"photo_focal.{field}": "Focal point must be between 0 and 100."}
            )
        updates[field] = focal_value

    if updates:
        InvitationMedia.objects.filter(
            invitation=invitation,
            role=InvitationMedia.Role.PHOTO,
        ).update(**updates)


def _sync_photo_cover_snapshot(invitation: Invitation) -> None:
    """Keep a public cover fallback inside content when media joins are unavailable."""
    cover_media = (
        InvitationMedia.objects.select_related("asset")
        .filter(
            invitation=invitation,
            role=InvitationMedia.Role.PHOTO,
            asset__archived_at__isnull=True,
            asset__resource_type=MediaAsset.ResourceType.IMAGE,
        )
        .order_by("sort_order", "id")
        .first()
    )
    content = dict(invitation.content) if isinstance(invitation.content, dict) else {}
    if cover_media is None:
        content.pop("cover", None)
    else:
        secure_url = str(cover_media.asset.secure_url or "").strip()
        parsed_url = urlparse(secure_url)
        if (
            parsed_url.scheme == "https"
            and (parsed_url.hostname or "").lower() == "res.cloudinary.com"
        ):
            content["cover"] = {
                "secure_url": secure_url,
                "focal_x": float(cover_media.focal_x),
                "focal_y": float(cover_media.focal_y),
            }
        else:
            content.pop("cover", None)

    if content != invitation.content:
        invitation.content = content
        invitation.save(update_fields=["content", "updated_at"])


def _manual_order_payload(data) -> dict:
    return {
        key: data[key]
        for key in [
            "reference",
            "status",
            "payment_status",
            "theme_slug",
            "package_code",
            "assigned_staff_username",
            "client_name",
            "client_email",
            "client_phone",
            "event_date",
            "total_amount",
            "currency",
            "notes",
            "custom_status",
            "custom_brief",
            "custom_approval_notes",
            "custom_checklist",
        ]
        if key in data
    }


class StaffDashboardMetricsView(APIView):
    permission_classes = [IsStaffRole]

    def get(self, request) -> Response:
        return Response(
            {
                "orders": dict(Order.objects.values_list("status").annotate(count=Count("id"))),
                "revenue_pipeline": Order.objects.exclude(
                    status__in=[Order.Status.CANCELLED, Order.Status.LEAD]
                ).aggregate(total=Sum("total_amount"))["total"]
                or 0,
                "audit_events": AuditEvent.objects.count(),
                "leads": WhatsAppIntent.objects.count(),
            }
        )


class StaffOrderListCreateView(ListCreateAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return (
            Order.objects.filter(archived_at__isnull=True)
            .select_related("theme", "package", "invitation", "whatsapp_intent")
            .prefetch_related("manual_payments")
        )

    def post(self, request, *args, **kwargs) -> Response:
        data = request.data.copy()
        reference = str(data.get("reference", "")).strip()
        if not reference or (
            _auto_order_reference(reference)
            and Order.objects.filter(reference__iexact=reference).exists()
        ):
            data["reference"] = _next_order_reference()
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=201)


class StaffOrderExportView(APIView):
    permission_classes = [IsStaffRole]
    renderer_classes = [StaffCSVRenderer, JSONRenderer]

    def get(self, request) -> HttpResponse:
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="niskala-orders.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "order_id",
                "client",
                "email",
                "phone",
                "package",
                "theme",
                "total_amount",
                "payment_status",
                "workflow_status",
                "order_date",
                "preview_url",
            ]
        )

        orders = (
            Order.objects.filter(archived_at__isnull=True)
            .select_related("theme", "package", "invitation")
            .order_by("-created_at")
        )
        for order in orders:
            preview_url = ""
            if order.invitation_id:
                preview_url = StaffOrderDetailSerializer(
                    order,
                    context={"request": request},
                ).data.get("preview_url", "")
            writer.writerow(
                [
                    order.reference,
                    order.client_name,
                    order.client_email,
                    order.client_phone,
                    order.package.code if order.package_id else "",
                    order.theme.slug if order.theme_id else "",
                    order.total_amount,
                    order.get_payment_status_display(),
                    order.get_status_display(),
                    order.created_at.isoformat(),
                    preview_url,
                ]
            )

        return response


def _scope_agreement_payload(scope: BespokeScopeAgreement) -> dict:
    return {
        "id": str(scope.id),
        "version": scope.version,
        "status": scope.status,
        "scope": scope.scope,
        "total_amount": str(scope.total_amount),
        "currency": scope.currency,
        "revision_limit": scope.revision_limit,
        "production_days_min": scope.production_days_min,
        "production_days_max": scope.production_days_max,
        "checksum": scope.checksum,
        "sent_at": scope.sent_at,
        "approved_at": scope.approved_at,
    }


class StaffBespokeConfigView(APIView):
    permission_classes = [IsStaffRole]

    def _order(self, reference: str) -> Order:
        order = _detail_queryset().filter(reference=reference, archived_at__isnull=True).first()
        if order is None:
            from django.http import Http404

            raise Http404
        if not settings.BESPOKE_ENGINE_ENABLED:
            raise ValidationError({"bespoke": "Bespoke Engine is disabled."})
        return order

    def get(self, request, reference: str) -> Response:
        order = self._order(reference)
        if not order.invitation_id:
            _ensure_invitation(order)
            order.refresh_from_db()
        invitation = ensure_bespoke_invitation(order)
        return Response({"config": invitation.content.get("bespoke")})

    def patch(self, request, reference: str) -> Response:
        require_recent_staff_mfa(request)
        order = self._order(reference)
        if not order.invitation_id:
            _ensure_invitation(order)
            order.refresh_from_db()
        config = request.data.get("config")
        if not isinstance(config, dict):
            raise ValidationError({"config": "Structured Bespoke configuration is required."})
        invitation = update_bespoke_config(order, config)
        AuditEvent.objects.create(
            actor=request.user,
            action="bespoke.config_updated",
            resource_type="order",
            resource_reference=order.reference,
            metadata={"design_version": config.get("designVersion")},
        )
        return Response({"config": invitation.content.get("bespoke")})


class StaffBespokeScopeView(APIView):
    permission_classes = [IsStaffRole]

    def _order(self, reference: str) -> Order:
        order = _detail_queryset().filter(reference=reference, archived_at__isnull=True).first()
        if order is None:
            from django.http import Http404

            raise Http404
        return order

    def get(self, request, reference: str) -> Response:
        order = self._order(reference)
        return Response(
            [_scope_agreement_payload(item) for item in order.bespoke_scope_agreements.all()]
        )

    def post(self, request, reference: str) -> Response:
        require_recent_staff_mfa(request)
        order = self._order(reference)
        agreement = create_scope_agreement(order, request.data)
        AuditEvent.objects.create(
            actor=request.user,
            action="bespoke.scope_created",
            resource_type="order",
            resource_reference=order.reference,
            metadata={"scope_version": agreement.version, "checksum": agreement.checksum},
        )
        return Response(_scope_agreement_payload(agreement), status=201)


class StaffBespokeChangeRequestView(APIView):
    permission_classes = [IsStaffRole]

    def _order(self, reference: str) -> Order:
        order = _detail_queryset().filter(reference=reference, archived_at__isnull=True).first()
        if order is None:
            from django.http import Http404

            raise Http404
        return order

    def get(self, request, reference: str) -> Response:
        order = self._order(reference)
        return Response(
            [
                {
                    "id": str(item.id),
                    "status": item.status,
                    "description": item.description,
                    "price_delta": str(item.price_delta),
                    "schedule_delta_days": item.schedule_delta_days,
                    "scope_id": str(item.scope_agreement_id),
                    "approved_at": item.approved_at,
                }
                for item in order.bespoke_change_requests.select_related("scope_agreement")
            ]
        )

    @transaction.atomic
    def post(self, request, reference: str) -> Response:
        require_recent_staff_mfa(request)
        order = self._order(reference)
        if not order.invitation_id or order.invitation.status != Invitation.Status.PUBLISHED:
            raise ValidationError(
                {"invitation": "Change requests are only used after initial publication."}
            )
        description = str(request.data.get("description") or "").strip()
        scope = request.data.get("scope")
        if not description or not isinstance(scope, dict) or not scope:
            raise ValidationError(
                {"change_request": "Description and updated structured scope are required."}
            )
        try:
            price_delta = Decimal(str(request.data.get("price_delta") or "0"))
            schedule_delta = int(request.data.get("schedule_delta_days") or 0)
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise ValidationError(
                {"change_request": "Price or schedule delta is invalid."}
            ) from exc
        if price_delta < 0 or schedule_delta < 0:
            raise ValidationError({"change_request": "Deltas cannot be negative."})
        current_scope = order.bespoke_scope_agreements.filter(
            status=BespokeScopeAgreement.Status.APPROVED
        ).first()
        revision_limit = current_scope.revision_limit if current_scope else 8
        minimum_days = (current_scope.production_days_min if current_scope else 10) + schedule_delta
        maximum_days = (current_scope.production_days_max if current_scope else 14) + schedule_delta
        agreement = create_scope_agreement(
            order,
            {
                "scope": scope,
                "total_amount": order.total_amount + price_delta,
                "revision_limit": revision_limit,
                "production_days_min": minimum_days,
                "production_days_max": maximum_days,
            },
        )
        agreement.status = BespokeScopeAgreement.Status.SENT
        agreement.sent_at = timezone.now()
        agreement.save(update_fields=["status", "sent_at", "updated_at"])
        change = BespokeChangeRequest.objects.create(
            order=order,
            scope_agreement=agreement,
            status=BespokeChangeRequest.Status.SENT,
            description=description,
            price_delta=price_delta,
            schedule_delta_days=schedule_delta,
        )
        AuditEvent.objects.create(
            actor=request.user,
            action="bespoke.change_request_created",
            resource_type="order",
            resource_reference=order.reference,
            metadata={"change_request": str(change.id), "scope_version": agreement.version},
        )
        return Response(
            {
                "id": str(change.id),
                "status": change.status,
                "scope": _scope_agreement_payload(agreement),
            },
            status=201,
        )


class StaffBespokeReviewCreateView(APIView):
    permission_classes = [IsStaffRole]

    @transaction.atomic
    def post(self, request, reference: str) -> Response:
        require_recent_staff_mfa(request)
        order = _detail_queryset().filter(reference=reference, archived_at__isnull=True).first()
        if order is None:
            from django.http import Http404

            raise Http404
        if not order.invitation_id:
            _ensure_invitation(order)
            order.refresh_from_db()
        invitation = ensure_bespoke_invitation(order)
        purpose = str(request.data.get("purpose") or "").strip()
        if purpose == ClientReviewSession.Purpose.SCOPE:
            scope_id = request.data.get("scope_id")
            scope = order.bespoke_scope_agreements.filter(pk=scope_id).first()
            if scope is None:
                raise ValidationError({"scope_id": "Scope agreement was not found."})
            scope.status = BespokeScopeAgreement.Status.SENT
            scope.sent_at = timezone.now()
            scope.save(update_fields=["status", "sent_at", "updated_at"])
            session, raw_token = create_review_session(
                invitation=invitation,
                purpose=purpose,
                scope=scope,
            )
            order.custom_status = Order.CustomStatus.SCOPING
            order.status = (
                Order.Status.PUBLISHED
                if invitation.status == Invitation.Status.PUBLISHED
                else Order.Status.CONSULTING
            )
            order.save(update_fields=["custom_status", "status", "updated_at"])
        elif purpose == ClientReviewSession.Purpose.FINAL:
            if (
                invitation.status == Invitation.Status.PUBLISHED
                and not order.bespoke_change_requests.filter(
                    status=BespokeChangeRequest.Status.APPROVED
                ).exists()
            ):
                raise ValidationError(
                    {"change_request": "Approve a paid change request before final review."}
                )
            scope = order.bespoke_scope_agreements.filter(
                status=BespokeScopeAgreement.Status.APPROVED
            ).first()
            if scope is None:
                raise ValidationError({"scope": "Approve the Bespoke scope first."})
            next_number = (
                invitation.revisions.order_by("-revision_number")
                .values_list("revision_number", flat=True)
                .first()
                or 0
            ) + 1
            revision = InvitationRevision.objects.create(
                invitation=invitation,
                revision_number=next_number,
                content=invitation.content,
                note="Final client approval",
                is_final_check=True,
                created_by=request.user,
            )
            session, raw_token = create_review_session(
                invitation=invitation,
                purpose=purpose,
                revision=revision,
            )
            invitation.approval_status = Invitation.ApprovalStatus.CLIENT_REVIEW
            invitation.save(update_fields=["approval_status", "updated_at"])
            order.custom_status = Order.CustomStatus.READY
            order.status = (
                Order.Status.PUBLISHED
                if invitation.status == Invitation.Status.PUBLISHED
                else Order.Status.CLIENT_REVIEW
            )
            order.save(update_fields=["custom_status", "status", "updated_at"])
        else:
            raise ValidationError({"purpose": "Use scope or final."})
        AuditEvent.objects.create(
            actor=request.user,
            action=f"bespoke.{purpose}_review_created",
            resource_type="order",
            resource_reference=order.reference,
            metadata={"session": str(session.id)},
        )
        return Response(
            {
                "purpose": purpose,
                "token": raw_token,
                "review_path": f"/review/{raw_token}",
                "expires_at": session.expires_at,
            },
            status=201,
        )


class StaffOrderDetailView(RetrieveUpdateAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = OrderSerializer
    lookup_field = "reference"

    def get_queryset(self):
        return _detail_queryset().filter(archived_at__isnull=True)

    def get(self, request, *args, **kwargs) -> Response:
        order = self.get_object()
        serializer = StaffOrderDetailSerializer(order, context={"request": request})
        return Response(serializer.data)

    def patch(self, request, *args, **kwargs) -> Response:
        require_recent_staff_mfa(request)
        order = self.get_object()
        previous_theme = order.theme.slug if order.theme_id else None
        previous_package = order.package.code if order.package_id else None
        previous_custom_status = order.custom_status
        previous_custom_fields = {
            "custom_approval_notes": order.custom_approval_notes,
            "custom_brief": order.custom_brief,
            "custom_checklist": dict(order.custom_checklist or {}),
        }
        nested_keys = {
            "ceremony",
            "reception",
            "bank_accounts",
            "rsvp_manual",
            "media_urls",
            "photo_focal",
            "quote",
            "story",
            "timeline",
        }
        should_sync_invitation = bool(
            nested_keys.intersection(request.data) or "client_name" in request.data
        )
        if (
            (should_sync_invitation or {"theme_slug", "package_code"}.intersection(request.data))
            and order.invitation_id
            and order.invitation.status == Invitation.Status.PUBLISHED
        ):
            raise ValidationError(
                {"invitation": "Published invitations are immutable. Use a change request."}
            )
        serializer = self.get_serializer(
            order,
            data=_manual_order_payload(request.data),
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            updated = serializer.save()
            if updated.status == Order.Status.PUBLISHED:
                _publish_invitation_for_order(updated, request.user)
            if should_sync_invitation:
                invitation = _ensure_invitation(updated)
                if "client_name" in request.data:
                    _sync_invitation_couple(invitation, updated.client_name)
                _update_event(
                    invitation,
                    WeddingEvent.EventType.CEREMONY,
                    request.data.get("ceremony", {}),
                )
                _update_event(
                    invitation,
                    WeddingEvent.EventType.RECEPTION,
                    request.data.get("reception", {}),
                )
                _update_invitation_content(invitation, request.data)
                media_urls = request.data.get("media_urls") or {}
                if isinstance(media_urls, dict):
                    if "photo" in media_urls:
                        _replace_media(
                            invitation,
                            InvitationMedia.Role.PHOTO,
                            [str(media_urls.get("photo") or "")],
                        )
                    if "gallery" in media_urls:
                        gallery_urls = [str(item) for item in media_urls.get("gallery") or []]
                        _replace_media(
                            invitation,
                            InvitationMedia.Role.GALLERY,
                            gallery_urls,
                        )
                        _update_invitation_content(invitation, {"gallery": gallery_urls})
                    if "backsound" in media_urls:
                        _replace_media(
                            invitation,
                            InvitationMedia.Role.BACKSOUND,
                            [str(media_urls.get("backsound") or "")],
                        )
                if "photo_focal" in request.data:
                    _update_photo_focal_point(invitation, request.data.get("photo_focal"))
                if (
                    isinstance(media_urls, dict) and "photo" in media_urls
                ) or "photo_focal" in request.data:
                    _sync_photo_cover_snapshot(invitation)
                AuditEvent.objects.create(
                    actor=request.user,
                    action="order.manual_detail_updated",
                    resource_type="order",
                    resource_reference=updated.reference,
                    metadata={"nested_fields": sorted(nested_keys.intersection(request.data))},
                )
            current_theme = updated.theme.slug if updated.theme_id else None
            current_package = updated.package.code if updated.package_id else None
            if previous_theme != current_theme:
                AuditEvent.objects.create(
                    actor=request.user,
                    action="order.theme_changed",
                    resource_type="order",
                    resource_reference=updated.reference,
                    metadata={"from": previous_theme, "to": current_theme},
                )
            if previous_package != current_package:
                AuditEvent.objects.create(
                    actor=request.user,
                    action="order.package_changed",
                    resource_type="order",
                    resource_reference=updated.reference,
                    metadata={"from": previous_package, "to": current_package},
                )
            if "bank_accounts" in request.data:
                accounts = request.data.get("bank_accounts")
                AuditEvent.objects.create(
                    actor=request.user,
                    action="invitation.bank_accounts_changed",
                    resource_type="order",
                    resource_reference=updated.reference,
                    metadata={
                        "account_count": len(accounts) if isinstance(accounts, list) else 0,
                    },
                )
            custom_fields = {
                key
                for key in previous_custom_fields
                if key in request.data and previous_custom_fields[key] != getattr(updated, key)
            }
            if "custom_status" in request.data and previous_custom_status != updated.custom_status:
                custom_fields.add("custom_status")
            if custom_fields:
                AuditEvent.objects.create(
                    actor=request.user,
                    action="order.custom_request_changed",
                    resource_type="order",
                    resource_reference=updated.reference,
                    metadata={
                        "changed_fields": sorted(custom_fields),
                        "status_from": previous_custom_status,
                        "status_to": updated.custom_status,
                    },
                )
        updated = _detail_queryset().get(pk=updated.pk)
        detail = StaffOrderDetailSerializer(updated, context={"request": request})
        return Response(detail.data)

    def delete(self, request, *args, **kwargs) -> Response:
        require_recent_staff_mfa(request)
        order = self.get_object()
        order.archived_at = timezone.now()
        order.save(update_fields=["archived_at", "updated_at"])
        AuditEvent.objects.create(
            actor=request.user,
            action="order.archived",
            resource_type="order",
            resource_reference=order.reference,
            metadata={"source": "staff_dashboard"},
        )
        return Response(status=204)


class StaffOrderRevisionListCreateView(APIView):
    permission_classes = [IsStaffRole]

    def post(self, request, reference: str) -> Response:
        order = Order.objects.select_related("invitation").filter(reference=reference).first()
        if order is None or order.invitation_id is None:
            from django.http import Http404

            raise Http404

        serializer = StaffOrderRevisionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        next_number = (
            order.invitation.revisions.aggregate(max_number=Max("revision_number"))["max_number"]
            or 0
        ) + 1
        revision = InvitationRevision.objects.create(
            invitation=order.invitation,
            revision_number=next_number,
            content=order.invitation.content,
            note=serializer.validated_data["note"],
            is_final_check=serializer.validated_data["is_final_check"],
            created_by=request.user,
        )
        AuditEvent.objects.create(
            actor=request.user,
            action="invitation.revision_noted",
            resource_type="order",
            resource_reference=order.reference,
            metadata={
                "invitation": order.invitation.public_slug,
                "revision_number": revision.revision_number,
                "is_final_check": revision.is_final_check,
            },
        )
        detail = StaffOrderDetailSerializer(
            order,
            context={"request": request},
        )
        return Response(detail.data, status=201)


class StaffOrderRevisionDetailView(APIView):
    permission_classes = [IsStaffRole]

    def patch(self, request, reference: str, revision_id: str) -> Response:
        order = _detail_queryset().filter(reference=reference, archived_at__isnull=True).first()
        if order is None or order.invitation_id is None:
            from django.http import Http404

            raise Http404
        revision = order.invitation.revisions.filter(id=revision_id).first()
        if revision is None:
            from django.http import Http404

            raise Http404
        if "note" in request.data:
            revision.note = str(request.data.get("note", "")).strip()
        if "is_final_check" in request.data:
            revision.is_final_check = bool(request.data.get("is_final_check"))
        revision.save(update_fields=["note", "is_final_check", "updated_at"])
        AuditEvent.objects.create(
            actor=request.user,
            action="invitation.revision_updated",
            resource_type="order",
            resource_reference=order.reference,
            metadata={
                "invitation": order.invitation.public_slug,
                "revision_number": revision.revision_number,
                "is_final_check": revision.is_final_check,
            },
        )
        order = _detail_queryset().get(pk=order.pk)
        detail = StaffOrderDetailSerializer(order, context={"request": request})
        return Response(detail.data)


class StaffVerificationQueueView(ListAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = OrderSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            Order.objects.filter(status=Order.Status.PENDING)
            .select_related("theme", "package", "invitation", "client_user")
            .order_by("created_at")
        )


class StaffConfirmOrderView(APIView):
    permission_classes = [IsStaffRole]

    def post(self, request, reference: str) -> Response:
        require_recent_staff_mfa(request)
        order = (
            Order.objects.select_related("invitation", "client_user")
            .filter(reference=reference)
            .first()
        )
        if order is None:
            from django.http import Http404

            raise Http404
        serializer = StaffVerificationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = staff_confirm_order(
            order=order,
            actor=request.user,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(OrderSerializer(updated, context={"request": request}).data)


class StaffRejectOrderView(APIView):
    permission_classes = [IsStaffRole]

    def post(self, request, reference: str) -> Response:
        require_recent_staff_mfa(request)
        order = (
            Order.objects.select_related("invitation", "client_user")
            .filter(reference=reference)
            .first()
        )
        if order is None:
            from django.http import Http404

            raise Http404
        serializer = StaffRejectOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = staff_reject_order(
            order=order,
            actor=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(OrderSerializer(updated, context={"request": request}).data)


class StaffClientLifecycleListView(ListAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = StaffClientLifecycleSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = Order.objects.select_related("invitation").exclude(invitation__isnull=True)
        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(Q(status=status) | Q(invitation__status=status))
        return queryset.order_by("client_name", "reference")


class StaffArchiveWeddingView(APIView):
    permission_classes = [IsStaffRole]

    def post(self, request, public_slug: str) -> Response:
        require_recent_staff_mfa(request)
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            from django.http import Http404

            raise Http404
        reason = str(request.data.get("reason", "")).strip()
        updated = archive_expired_wedding(invitation=invitation, actor=request.user, reason=reason)
        return Response({"public_slug": updated.public_slug, "status": updated.status})


class BillingLifecycleRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request) -> Response:
        configured_secret = getattr(settings, "BILLING_CRON_SECRET", "")
        supplied_secret = request.headers.get("X-Cron-Secret", "")
        if configured_secret and supplied_secret != configured_secret:
            return Response({"detail": "Forbidden"}, status=403)

        now = timezone.now()
        warning_days = int(getattr(settings, "BILLING_EXPIRY_WARNING_DAYS", 14))
        warning_at = now + timedelta(days=warning_days)
        expiring = Invitation.objects.filter(
            status=Invitation.Status.ACTIVE,
            expires_at__isnull=False,
            expires_at__lte=warning_at,
            expires_at__gt=now,
        )
        expired = Invitation.objects.filter(
            status__in=[Invitation.Status.ACTIVE, Invitation.Status.EXPIRING_SOON],
            expires_at__isnull=False,
            expires_at__lte=now,
        )

        expiring_count = 0
        for invitation in expiring:
            invitation.status = Invitation.Status.EXPIRING_SOON
            invitation.save(update_fields=["status", "updated_at"])
            enqueue_client_notification(
                recipient=invitation_client_recipient(invitation),
                event_type="wedding.expiring_soon",
                payload={
                    "invitation": invitation.public_slug,
                    "expires_at": invitation.expires_at.isoformat(),
                },
            )
            expiring_count += 1

        expired_count = expired.update(status=Invitation.Status.EXPIRED, updated_at=now)
        return Response({"expiring_soon": expiring_count, "expired": expired_count})

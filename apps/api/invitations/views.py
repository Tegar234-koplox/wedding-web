import csv
import hashlib
from datetime import timedelta
from urllib.parse import urlencode, urlparse

from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ObjectDoesNotExist
from django.db import connection
from django.http import Http404, HttpResponse
from django.utils import timezone
from django.utils.crypto import constant_time_compare, get_random_string
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics.models import AnalyticsEvent
from common.models import AuditEvent
from common.notifications import enqueue_client_notification
from invitations.models import Guest, Invitation, InvitationMedia
from invitations.preview import preview_token_for, preview_token_is_valid
from invitations.selectors import public_invitations
from invitations.serializers import (
    BacksoundAssetSerializer,
    GuestAggregateSerializer,
    InvitationBacksoundSerializer,
    PublicGuestRSVPCreateSerializer,
    PublicInvitationSerializer,
    PublicRSVPSerializer,
    StaffGuestLinkCreateSerializer,
    StaffGuestLinkSerializer,
    StaffInvitationOperationSerializer,
)
from media_library.models import MediaAsset
from media_library.services import ALLOWED_AUDIO_FORMATS, public_audio_payload
from orders.models import Order
from orders.permissions import IsStaffRole
from weather.services import weather_for_invitation


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
        return Response(PublicInvitationSerializer(invitation).data)


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
            },
        )
    )
    def get(self, request, public_slug: str) -> Response:
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
        "token_available": bool(token),
        "created_at": guest.created_at,
    }


def _guest_delivery_queryset(invitation: Invitation):
    return invitation.guests.filter(
        archived_at__isnull=True,
        anonymized_at__isnull=True,
    ).order_by("created_at")


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


def _generate_guest_delivery_token() -> str:
    while True:
        token = get_random_string(40)
        if not Guest.objects.filter(access_token_hash=token).exists():
            return token


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
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        if invitation.status == Invitation.Status.PUBLISHED:
            return Response(
                {"status": invitation.status, "approval_status": invitation.approval_status}
            )
        if invitation.approval_status != Invitation.ApprovalStatus.APPROVED_FOR_PUBLISH:
            from rest_framework.exceptions import ValidationError

            raise ValidationError(
                {"approval_status": "Client approval is required before staff publish."}
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


class StaffInvitationGuestLinkExportView(APIView):
    permission_classes = [IsStaffRole]

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
                    payload["display_name"],
                    payload["email"],
                    payload["phone"],
                    payload["party_size"],
                    payload["rsvp_status"],
                    payload["attendance_count"],
                    payload["delivery_url"] or "",
                ]
            )
        return response


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

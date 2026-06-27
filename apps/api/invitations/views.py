import csv
import hashlib
from datetime import timedelta
from urllib.parse import urlparse

from django.contrib.auth.hashers import check_password, make_password
from django.db.models import Q
from django.http import Http404, HttpResponse
from django.utils import timezone
from django.utils.crypto import constant_time_compare, get_random_string
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.generics import ListAPIView, RetrieveAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics.models import AnalyticsEvent
from common.models import AuditEvent
from invitations.models import Guest, Invitation, InvitationMedia
from invitations.selectors import public_invitations
from invitations.serializers import (
    BacksoundAssetSerializer,
    ClientInvitationSerializer,
    GuestSerializer,
    InvitationBacksoundSerializer,
    PublicInvitationSerializer,
    PublicRSVPSerializer,
    StaffInvitationOperationSerializer,
)
from media_library.models import MediaAsset
from media_library.services import ALLOWED_AUDIO_FORMATS, public_audio_payload
from orders.models import Order
from orders.permissions import IsClientOwner, IsStaffRole
from weather.services import weather_for_invitation


class InvitationDetailView(RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicInvitationSerializer
    lookup_field = "public_slug"

    def get_queryset(self):
        return public_invitations()


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


def _active_guests(invitation: Invitation):
    return invitation.guests.filter(archived_at__isnull=True, anonymized_at__isnull=True)


def _client_owned_invitations(user):
    return Invitation.objects.filter(Q(client_user=user) | Q(order__client_user=user)).distinct()


def _client_owned_invitation(user, public_slug: str) -> Invitation | None:
    return _client_owned_invitations(user).filter(public_slug=public_slug).first()


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
    return _backsound_response(invitation)


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
        invitation = public_invitations().filter(public_slug=public_slug).first()
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

            raise ValidationError({"attendance_count": "Attendance exceeds party size."})

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


class ClientInvitationListView(ListAPIView):
    permission_classes = [IsClientOwner]
    serializer_class = ClientInvitationSerializer
    pagination_class = None

    def get_queryset(self):
        return _client_owned_invitations(self.request.user).select_related(
            "theme",
            "package",
        )


class ClientInvitationDetailView(RetrieveUpdateAPIView):
    permission_classes = [IsClientOwner]
    serializer_class = ClientInvitationSerializer
    lookup_field = "public_slug"

    def get_queryset(self):
        return _client_owned_invitations(self.request.user).select_related(
            "theme",
            "package",
        )


class ClientInvitationSubmitRevisionView(APIView):
    permission_classes = [IsClientOwner]

    def post(self, request, public_slug: str) -> Response:
        invitation = _client_owned_invitation(request.user, public_slug)
        if invitation is None:
            raise Http404
        invitation.approval_status = Invitation.ApprovalStatus.SUBMITTED
        invitation.status = Invitation.Status.REVIEW
        invitation.save(update_fields=["approval_status", "status", "updated_at"])
        AuditEvent.objects.create(
            actor=request.user,
            action="invitation.revision_submitted",
            resource_type="invitation",
            resource_reference=invitation.public_slug,
        )
        return Response(
            {"approval_status": invitation.approval_status, "status": invitation.status}
        )


class ClientInvitationApprovePublishView(APIView):
    permission_classes = [IsClientOwner]

    def post(self, request, public_slug: str) -> Response:
        invitation = _client_owned_invitation(request.user, public_slug)
        if invitation is None:
            raise Http404
        invitation.approval_status = Invitation.ApprovalStatus.APPROVED_FOR_PUBLISH
        invitation.save(update_fields=["approval_status", "updated_at"])
        AuditEvent.objects.create(
            actor=request.user,
            action="invitation.publish_approved",
            resource_type="invitation",
            resource_reference=invitation.public_slug,
        )
        return Response({"approval_status": invitation.approval_status})


class ClientInvitationGuestListView(APIView):
    permission_classes = [IsClientOwner]

    def get(self, request, public_slug: str) -> Response:
        invitation = _client_owned_invitation(request.user, public_slug)
        if invitation is None:
            raise Http404
        return Response(GuestSerializer(_active_guests(invitation), many=True).data)


class ClientInvitationMusicView(APIView):
    permission_classes = [IsClientOwner]

    def get(self, request, public_slug: str) -> Response:
        invitation = _client_owned_invitation(request.user, public_slug)
        if invitation is None:
            raise Http404
        return Response(_backsound_response(invitation))

    def patch(self, request, public_slug: str) -> Response:
        invitation = _client_owned_invitation(request.user, public_slug)
        if invitation is None:
            raise Http404
        if invitation.approval_status in {
            Invitation.ApprovalStatus.APPROVED_FOR_PUBLISH,
            Invitation.ApprovalStatus.PUBLISHED,
        }:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"music": "Approved invitations cannot be edited by client."})
        asset = _asset_from_music_payload(request.data)
        return Response(
            _set_invitation_backsound(
                invitation=invitation,
                actor=request.user,
                asset=asset,
            )
        )


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
    minimum_role = "editor"

    def post(self, request, public_slug: str) -> Response:
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        invitation.status = Invitation.Status.PUBLISHED
        invitation.approval_status = Invitation.ApprovalStatus.PUBLISHED
        invitation.published_at = timezone.now()
        invitation.save(update_fields=["status", "approval_status", "published_at", "updated_at"])
        order = getattr(invitation, "order", None)
        if order is not None and order.status != Order.Status.PUBLISHED:
            old_status = order.status
            order.status = Order.Status.PUBLISHED
            order.save(update_fields=["status", "updated_at"])
            AuditEvent.objects.create(
                actor=request.user,
                action="order.status_changed",
                resource_type="order",
                resource_reference=order.reference,
                metadata={"old_status": old_status, "status": order.status},
            )
        AuditEvent.objects.create(
            actor=request.user,
            action="invitation.published",
            resource_type="invitation",
            resource_reference=invitation.public_slug,
        )
        return Response(
            {"status": invitation.status, "approval_status": invitation.approval_status}
        )


class StaffInvitationGuestListCreateView(APIView):
    permission_classes = [IsStaffRole]
    minimum_role = "support"

    def get_permissions(self):
        self.minimum_role = "viewer" if self.request.method == "GET" else "support"
        return super().get_permissions()

    def get(self, request, public_slug: str) -> Response:
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        return Response(GuestSerializer(_active_guests(invitation), many=True).data)

    def post(self, request, public_slug: str) -> Response:
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            raise Http404
        serializer = GuestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        personal_token = get_random_string(40)
        guest = Guest.objects.create(
            invitation=invitation,
            access_token_hash=make_password(personal_token),
            display_name=serializer.validated_data["display_name"],
            email=serializer.validated_data.get("email", ""),
            phone=serializer.validated_data.get("phone", ""),
            party_size=serializer.validated_data.get("party_size", 1),
        )
        AuditEvent.objects.create(
            actor=request.user,
            action="guest.created",
            resource_type="guest",
            resource_reference=str(guest.id),
            metadata={"invitation": invitation.public_slug},
        )
        return Response(
            {
                **GuestSerializer(guest).data,
                "personal_token": personal_token,
            },
            status=201,
        )


class StaffInvitationMusicView(APIView):
    permission_classes = [IsStaffRole]
    minimum_role = "support"

    def get_permissions(self):
        self.minimum_role = "viewer" if self.request.method == "GET" else "support"
        return super().get_permissions()

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


class ClientGuestExportView(APIView):
    permission_classes = [IsClientOwner]

    def get(self, request, public_slug: str) -> HttpResponse:
        invitation = _client_owned_invitation(request.user, public_slug)
        if invitation is None:
            raise Http404
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{public_slug}-guests.csv"'
        writer = csv.writer(response)
        writer.writerow(
            ["display_name", "rsvp_status", "attendance_count", "wishes", "responded_at"]
        )
        for guest in invitation.guests.filter(archived_at__isnull=True, anonymized_at__isnull=True):
            writer.writerow(
                [
                    guest.display_name,
                    guest.rsvp_status,
                    guest.attendance_count,
                    guest.wishes,
                    guest.responded_at.isoformat() if guest.responded_at else "",
                ]
            )
        return response


class StaffGuestAnonymizeView(APIView):
    permission_classes = [IsStaffRole]
    minimum_role = "support"

    def post(self, request, guest_id: str) -> Response:
        guest = Guest.objects.filter(id=guest_id).first()
        if guest is None:
            raise Http404
        guest.anonymize()
        guest.save(
            update_fields=[
                "display_name",
                "email",
                "phone",
                "wishes",
                "metadata",
                "anonymized_at",
                "updated_at",
            ]
        )
        AuditEvent.objects.create(
            actor=request.user,
            action="guest.anonymized",
            resource_type="guest",
            resource_reference=str(guest.id),
        )
        return Response({"status": "anonymized"})


class StaffGuestArchiveView(APIView):
    permission_classes = [IsStaffRole]
    minimum_role = "support"

    def post(self, request, guest_id: str) -> Response:
        guest = Guest.objects.filter(id=guest_id).first()
        if guest is None:
            raise Http404
        guest.archived_at = timezone.now()
        guest.save(update_fields=["archived_at", "updated_at"])
        AuditEvent.objects.create(
            actor=request.user,
            action="guest.archived",
            resource_type="guest",
            resource_reference=str(guest.id),
        )
        return Response({"status": "archived"})

import csv
from datetime import timedelta

from django.contrib.auth.hashers import check_password
from django.http import Http404, HttpResponse
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.generics import ListAPIView, RetrieveAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics.models import AnalyticsEvent
from common.models import AuditEvent
from invitations.models import Guest, Invitation
from invitations.selectors import public_invitations
from invitations.serializers import (
    ClientInvitationSerializer,
    PublicInvitationSerializer,
    PublicRSVPSerializer,
    StaffInvitationOperationSerializer,
)
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
        return Invitation.objects.filter(client_user=self.request.user).select_related(
            "theme",
            "package",
        )


class ClientInvitationDetailView(RetrieveUpdateAPIView):
    permission_classes = [IsClientOwner]
    serializer_class = ClientInvitationSerializer
    lookup_field = "public_slug"

    def get_queryset(self):
        return Invitation.objects.filter(client_user=self.request.user).select_related(
            "theme",
            "package",
        )


class ClientInvitationSubmitRevisionView(APIView):
    permission_classes = [IsClientOwner]

    def post(self, request, public_slug: str) -> Response:
        invitation = Invitation.objects.filter(
            client_user=request.user,
            public_slug=public_slug,
        ).first()
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
        invitation = Invitation.objects.filter(
            client_user=request.user,
            public_slug=public_slug,
        ).first()
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


class ClientGuestExportView(APIView):
    permission_classes = [IsClientOwner]

    def get(self, request, public_slug: str) -> HttpResponse:
        invitation = Invitation.objects.filter(
            client_user=request.user,
            public_slug=public_slug,
        ).first()
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

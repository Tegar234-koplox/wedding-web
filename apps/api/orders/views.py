from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Max, Prefetch, Q, Sum
from django.utils import timezone
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.models import AuditEvent
from common.notifications import enqueue_client_notification
from invitations.models import Invitation, InvitationMedia, InvitationRevision, WeddingEvent
from leads.models import WhatsAppIntent
from orders.lifecycle import (
    archive_expired_wedding,
    invitation_client_recipient,
    staff_confirm_order,
    staff_reject_order,
)
from orders.models import Order
from orders.permissions import IsStaffRole
from orders.serializers import (
    OrderSerializer,
    StaffClientLifecycleSerializer,
    StaffOrderDetailSerializer,
    StaffOrderRevisionCreateSerializer,
    StaffRejectOrderSerializer,
    StaffVerificationActionSerializer,
)


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
        return Order.objects.select_related("theme", "package", "invitation", "whatsapp_intent")


class StaffOrderDetailView(RetrieveUpdateAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = OrderSerializer
    lookup_field = "reference"

    def get_queryset(self):
        return (
            Order.objects.select_related(
                "theme",
                "package",
                "invitation",
                "invitation__theme",
                "invitation__package",
                "whatsapp_intent",
                "assigned_staff",
                "client_user",
            )
            .prefetch_related(
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
            )
        )

    def get(self, request, *args, **kwargs) -> Response:
        order = self.get_object()
        serializer = StaffOrderDetailSerializer(order, context={"request": request})
        return Response(serializer.data)

    def patch(self, request, *args, **kwargs) -> Response:
        order = self.get_object()
        serializer = self.get_serializer(
            order,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        detail = StaffOrderDetailSerializer(updated, context={"request": request})
        return Response(detail.data)


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

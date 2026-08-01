from django.db import transaction
from django.http import Http404
from django.utils import timezone
from rest_framework.generics import ListCreateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from common.models import AuditEvent
from common.notifications import enqueue_client_notification
from common.permissions import (
    HasStaffRole,
    filter_order_related_for_staff,
    require_recent_staff_mfa,
    require_staff_order_access,
)
from orders.permissions import IsStaffRole
from tickets.models import Ticket
from tickets.serializers import StaffTicketUpdateSerializer, TicketSerializer
from users.models import User

TICKET_TRANSITIONS = {
    Ticket.Status.OPEN: {Ticket.Status.IN_PROGRESS},
    Ticket.Status.IN_PROGRESS: {Ticket.Status.RESOLVED},
    Ticket.Status.RESOLVED: set(),
}


def ticket_recipient(ticket: Ticket):
    if ticket.invitation.client_user_id:
        return ticket.invitation.client_user
    order = getattr(ticket.invitation, "order", None)
    return order.client_user if order else ticket.created_by


def ensure_ticket_transition(current: str, target: str) -> None:
    from rest_framework.exceptions import ValidationError

    if current == target:
        return
    if target not in TICKET_TRANSITIONS.get(current, set()):
        raise ValidationError({"status": f"Invalid ticket transition: {current} -> {target}."})


class StaffTicketListView(ListCreateAPIView):
    permission_classes = [IsStaffRole, HasStaffRole]
    required_staff_roles = (
        User.StaffRole.OWNER,
        User.StaffRole.SUPPORT,
    )
    serializer_class = TicketSerializer
    pagination_class = None
    http_method_names = ["get"]

    def get_queryset(self):
        queryset = Ticket.objects.select_related(
            "invitation",
            "invitation__client_user",
            "created_by",
            "assigned_staff",
        )
        category = self.request.query_params.get("category")
        status = self.request.query_params.get("status")
        if category:
            queryset = queryset.filter(category=category)
        if status:
            queryset = queryset.filter(status=status)
        return filter_order_related_for_staff(
            queryset,
            self.request.user,
            order_lookup="invitation__order",
        ).order_by("created_at")


class StaffTicketDetailView(APIView):
    permission_classes = [IsStaffRole, HasStaffRole]
    required_staff_roles = (
        User.StaffRole.OWNER,
        User.StaffRole.SUPPORT,
    )

    def patch(self, request, ticket_id: str) -> Response:
        queryset = Ticket.objects.select_related(
            "invitation",
            "invitation__order",
            "invitation__client_user",
            "created_by",
            "assigned_staff",
        ).filter(id=ticket_id)
        ticket = filter_order_related_for_staff(
            queryset,
            request.user,
            order_lookup="invitation__order",
        ).first()
        if ticket is None:
            raise Http404
        require_staff_order_access(request, ticket.invitation)
        serializer = StaffTicketUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "custom_domain" in data:
            require_recent_staff_mfa(request)

        with transaction.atomic():
            update_fields = ["updated_at"]
            old_status = ticket.status
            next_status = data.get("status", ticket.status)
            ensure_ticket_transition(ticket.status, next_status)
            if next_status != ticket.status:
                ticket.status = next_status
                update_fields.append("status")
                if next_status == Ticket.Status.RESOLVED:
                    ticket.resolved_at = timezone.now()
                    update_fields.append("resolved_at")

            if data.get("assign_to_self") and ticket.assigned_staff_id != request.user.id:
                ticket.assigned_staff = request.user
                update_fields.append("assigned_staff")

            if "resolution_note" in data:
                ticket.resolution_note = data["resolution_note"]
                update_fields.append("resolution_note")

            custom_domain = data.get("custom_domain")
            if custom_domain is not None and custom_domain != ticket.invitation.custom_domain:
                from rest_framework.exceptions import ValidationError

                if ticket.category != Ticket.Category.DNS:
                    raise ValidationError(
                        {"custom_domain": "Custom domain can only be set on DNS tickets."}
                    )
                reason = data.get("reason", "").strip()
                if not reason:
                    raise ValidationError({"reason": "DNS custom domain changes require a reason."})
                previous_domain = ticket.invitation.custom_domain
                ticket.invitation.custom_domain = custom_domain
                ticket.invitation.save(update_fields=["custom_domain", "updated_at"])
                AuditEvent.objects.create(
                    actor=request.user,
                    action="invitation.custom_domain_updated",
                    resource_type="invitation",
                    resource_reference=ticket.invitation.public_slug,
                    metadata={
                        "ticket": str(ticket.id),
                        "reason": reason,
                        "previous_domain": previous_domain,
                        "custom_domain": custom_domain,
                    },
                )
                enqueue_client_notification(
                    recipient=ticket_recipient(ticket),
                    event_type="invitation.custom_domain_updated",
                    payload={
                        "ticket": str(ticket.id),
                        "invitation": ticket.invitation.public_slug,
                        "custom_domain": custom_domain,
                    },
                )

            ticket.save(update_fields=sorted(set(update_fields)))

            if ticket.status != old_status:
                AuditEvent.objects.create(
                    actor=request.user,
                    action="ticket.status_changed",
                    resource_type="ticket",
                    resource_reference=str(ticket.id),
                    metadata={
                        "from": old_status,
                        "to": ticket.status,
                        "reason": data.get("reason", ""),
                    },
                )
                enqueue_client_notification(
                    recipient=ticket_recipient(ticket),
                    event_type="ticket.status_changed",
                    payload={
                        "ticket": str(ticket.id),
                        "status": ticket.status,
                        "invitation": ticket.invitation.public_slug,
                    },
                )

        return Response(TicketSerializer(ticket).data)

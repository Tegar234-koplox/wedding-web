from django.shortcuts import get_object_or_404
from rest_framework.generics import ListCreateAPIView, UpdateAPIView

from common.permissions import (
    HasStaffRole,
    filter_orders_for_staff,
    require_recent_staff_mfa,
    require_staff_order_access,
)
from orders.models import Order
from orders.permissions import IsStaffRole
from payments.serializers import PaymentRecordSerializer
from users.models import User


class StaffPaymentRecordListCreateView(ListCreateAPIView):
    permission_classes = [IsStaffRole, HasStaffRole]
    required_staff_roles = (
        User.StaffRole.OWNER,
        User.StaffRole.FINANCE,
    )
    serializer_class = PaymentRecordSerializer

    def get_order(self) -> Order:
        order = get_object_or_404(
            filter_orders_for_staff(
                Order.objects.filter(archived_at__isnull=True),
                self.request.user,
            ),
            reference=self.kwargs["reference"],
        )
        require_staff_order_access(self.request, order)
        return order

    def get_queryset(self):
        return self.get_order().manual_payments.select_related("recorded_by", "reviewed_by")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["order"] = self.get_order()
        return context

    def perform_create(self, serializer) -> None:
        require_recent_staff_mfa(self.request)
        serializer.save()


class StaffPaymentRecordUpdateView(UpdateAPIView):
    permission_classes = [IsStaffRole, HasStaffRole]
    required_staff_roles = (
        User.StaffRole.OWNER,
        User.StaffRole.FINANCE,
    )
    serializer_class = PaymentRecordSerializer
    lookup_url_kwarg = "payment_id"

    def get_order(self) -> Order:
        order = get_object_or_404(
            filter_orders_for_staff(
                Order.objects.filter(archived_at__isnull=True),
                self.request.user,
            ),
            reference=self.kwargs["reference"],
        )
        require_staff_order_access(self.request, order)
        return order

    def get_queryset(self):
        return self.get_order().manual_payments.select_related("recorded_by", "reviewed_by")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["order"] = self.get_order()
        return context

    def perform_update(self, serializer) -> None:
        require_recent_staff_mfa(self.request)
        serializer.save()

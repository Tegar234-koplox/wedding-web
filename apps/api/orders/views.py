from django.db.models import Count, Sum
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from common.models import AuditEvent
from leads.models import WhatsAppIntent
from orders.models import Order
from orders.permissions import IsClientOwner, IsStaffRole
from orders.serializers import ClientOrderSerializer, OrderSerializer


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
        return Order.objects.select_related("theme", "package", "invitation", "whatsapp_intent")


class ClientOrderListView(ListAPIView):
    permission_classes = [IsClientOwner]
    serializer_class = ClientOrderSerializer
    pagination_class = None

    def get_queryset(self):
        return Order.objects.filter(client_user=self.request.user).select_related(
            "theme",
            "package",
            "invitation",
        )

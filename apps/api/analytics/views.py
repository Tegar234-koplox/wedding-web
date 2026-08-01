from django.db.models import Count
from rest_framework.generics import CreateAPIView, ListAPIView
from rest_framework.permissions import AllowAny

from analytics.models import AnalyticsEvent
from analytics.serializers import AnalyticsEventSerializer, AnalyticsMetricsSerializer
from common.permissions import HasStaffRole
from orders.permissions import IsStaffRole
from users.models import User


class AnalyticsEventCreateView(CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = AnalyticsEventSerializer


class AnalyticsMetricsView(ListAPIView):
    permission_classes = [IsStaffRole, HasStaffRole]
    required_staff_roles = (User.StaffRole.OWNER,)
    serializer_class = AnalyticsMetricsSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            AnalyticsEvent.objects.values("event_type")
            .annotate(count=Count("id"))
            .order_by("event_type")
        )

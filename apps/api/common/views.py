from django.middleware.csrf import get_token
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.models import AuditEvent
from common.serializers import StaffAuditEventSerializer
from orders.permissions import IsStaffRole


class StaffAuditEventListView(ListAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = StaffAuditEventSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = AuditEvent.objects.select_related("actor")
        resource_type = self.request.query_params.get("resource_type")
        resource_reference = self.request.query_params.get("resource_reference")
        if resource_type:
            queryset = queryset.filter(resource_type=resource_type)
        if resource_reference:
            queryset = queryset.filter(resource_reference=resource_reference)
        return queryset[:100]


class CsrfTokenView(APIView):
    permission_classes = [AllowAny]

    def get(self, request) -> Response:
        return Response({"csrfToken": get_token(request)})

import logging

from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.http import HttpResponseRedirect
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import ValidationError as APIValidationError
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from analytics.models import AnalyticsEvent
from common.exceptions import ServiceUnavailable
from leads.models import WhatsAppIntent
from leads.serializers import StaffWhatsAppIntentSerializer
from leads.services import whatsapp_redirect_url
from orders.permissions import IsStaffRole

logger = logging.getLogger("wedding.api")


class WhatsAppRedirectView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "conversion"

    @extend_schema(
        parameters=[
            OpenApiParameter("locale", str, enum=["id", "en"]),
            OpenApiParameter("theme", str),
            OpenApiParameter("package", str),
            OpenApiParameter("campaign", str),
            OpenApiParameter("source", str),
        ],
        responses={302: OpenApiResponse(description="Redirect to the configured wa.me URL")},
    )
    def get(self, request) -> HttpResponseRedirect:
        locale = request.query_params.get("locale", "id")
        theme_slug = request.query_params.get("theme", "")
        package_code = request.query_params.get("package", "")
        try:
            target = whatsapp_redirect_url(
                locale=locale,
                theme_slug=theme_slug,
                package_code=package_code,
            )
        except ValidationError as exc:
            raise APIValidationError(
                {"cta": "Theme, package, or locale is not valid."}
            ) from exc
        except ImproperlyConfigured as exc:
            logger.exception("leads.whatsapp_redirect_unavailable")
            raise ServiceUnavailable(
                "WhatsApp redirect is temporarily unavailable."
            ) from exc

        try:
            intent = WhatsAppIntent.objects.create(
                theme_slug=theme_slug,
                package_code=package_code,
                locale=locale,
                campaign=request.query_params.get("campaign", "")[:120],
                source=request.query_params.get("source", "")[:120],
            )
            AnalyticsEvent.objects.create(
                event_type=AnalyticsEvent.EventType.WHATSAPP_CLICK,
                resource_type="whatsapp_intent",
                resource_reference=str(intent.id),
                whatsapp_intent=intent,
                locale=locale,
                campaign=intent.campaign,
                source=intent.source,
                metadata={"theme": theme_slug, "package": package_code},
            )
        except Exception:
            pass

        return HttpResponseRedirect(target)


class StaffWhatsAppIntentListView(ListAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = StaffWhatsAppIntentSerializer
    pagination_class = None

    def get_queryset(self):
        return WhatsAppIntent.objects.all()[:50]

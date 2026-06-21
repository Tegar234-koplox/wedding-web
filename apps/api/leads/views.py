from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.http import HttpResponseRedirect
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from leads.models import WhatsAppIntent
from leads.services import whatsapp_redirect_url


class WhatsAppRedirectView(APIView):
    permission_classes = [AllowAny]

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
        except (ValidationError, ImproperlyConfigured) as exc:
            from rest_framework.exceptions import ValidationError as APIValidationError

            raise APIValidationError({"cta": str(exc)}) from exc

        try:
            WhatsAppIntent.objects.create(
                theme_slug=theme_slug,
                package_code=package_code,
                locale=locale,
                campaign=request.query_params.get("campaign", "")[:120],
                source=request.query_params.get("source", "")[:120],
            )
        except Exception:
            pass

        return HttpResponseRedirect(target)

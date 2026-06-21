from django.conf import settings
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from site_settings.models import SiteSetting


class PublicSiteConfigView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        responses=inline_serializer(
            name="PublicSiteConfig",
            fields={
                "brand": serializers.JSONField(),
                "whatsapp": serializers.JSONField(),
            },
        )
    )
    def get(self, request) -> Response:
        configured = {
            item.key: item.public_value
            for item in SiteSetting.objects.exclude(public_value={}).only(
                "key",
                "public_value",
            )
        }
        return Response(
            {
                "brand": configured.get(
                    "brand",
                    {"name": "Niskala", "default_locale": "id", "locales": ["id", "en"]},
                ),
                "whatsapp": {
                    "configured": bool(settings.WHATSAPP_BUSINESS_NUMBER),
                },
                **{
                    key: value
                    for key, value in configured.items()
                    if key not in {"brand", "whatsapp"}
                },
            }
        )

from django.http import Http404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from invitations.selectors import public_invitations
from invitations.serializers import PublicInvitationSerializer
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

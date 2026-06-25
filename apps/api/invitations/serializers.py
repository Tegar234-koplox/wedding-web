from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from invitations.models import EventLocation, Invitation, WeddingEvent
from media_library.services import public_audio_payload


class EventLocationSerializer(serializers.ModelSerializer[EventLocation]):
    class Meta:
        model = EventLocation
        fields = [
            "province",
            "regency",
            "district",
            "village",
            "latitude",
            "longitude",
        ]


class WeddingEventSerializer(serializers.ModelSerializer[WeddingEvent]):
    location = EventLocationSerializer(read_only=True)

    class Meta:
        model = WeddingEvent
        fields = [
            "event_type",
            "starts_at",
            "ends_at",
            "timezone",
            "venue_name",
            "address",
            "map_url",
            "location",
        ]


class PublicInvitationAudioSerializer(serializers.Serializer):
    secure_url = serializers.URLField()
    title = serializers.CharField()
    loop = serializers.BooleanField()
    default_volume = serializers.FloatField(min_value=0, max_value=1)


class PublicInvitationSerializer(serializers.ModelSerializer[Invitation]):
    events = WeddingEventSerializer(many=True, read_only=True)
    theme_slug = serializers.CharField(source="theme.slug", read_only=True)
    package_code = serializers.CharField(
        source="package.code",
        read_only=True,
        allow_null=True,
    )
    locale = serializers.CharField(source="default_locale", read_only=True)
    rendererKey = serializers.CharField(source="renderer_key", read_only=True)
    rendererVersion = serializers.IntegerField(source="renderer_version", read_only=True)
    contentSchemaVersion = serializers.IntegerField(
        source="content_schema_version",
        read_only=True,
    )
    audio = serializers.SerializerMethodField()

    @extend_schema_field(PublicInvitationAudioSerializer(allow_null=True))
    def get_audio(self, obj: Invitation) -> dict[str, object] | None:
        invitation_audio = next(
            (
                item.asset
                for item in obj.media.all()
                if item.role == "backsound" and item.asset.archived_at is None
            ),
            None,
        )
        payload = public_audio_payload(invitation_audio)
        if payload is not None or not obj.is_sample:
            return payload

        theme_audio = next(
            (
                item.asset
                for item in obj.theme.media.all()
                if item.role == "audio" and item.asset.archived_at is None
            ),
            None,
        )
        return public_audio_payload(theme_audio)

    class Meta:
        model = Invitation
        fields = [
            "public_slug",
            "theme_slug",
            "package_code",
            "rendererKey",
            "rendererVersion",
            "contentSchemaVersion",
            "locale",
            "content",
            "audio",
            "events",
            "published_at",
        ]

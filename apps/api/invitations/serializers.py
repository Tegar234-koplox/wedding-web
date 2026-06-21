from rest_framework import serializers

from invitations.models import EventLocation, Invitation, WeddingEvent


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


class PublicInvitationSerializer(serializers.ModelSerializer[Invitation]):
    events = WeddingEventSerializer(many=True, read_only=True)
    theme_slug = serializers.CharField(source="theme.slug", read_only=True)
    package_code = serializers.CharField(source="package.code", read_only=True)
    locale = serializers.CharField(source="default_locale", read_only=True)

    class Meta:
        model = Invitation
        fields = [
            "public_slug",
            "theme_slug",
            "package_code",
            "renderer_key",
            "renderer_version",
            "content_schema_version",
            "locale",
            "content",
            "events",
            "published_at",
        ]

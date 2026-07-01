from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from invitations.models import (
    EventLocation,
    Guest,
    Invitation,
    InvitationMedia,
    WeddingEvent,
)
from media_library.models import MediaAsset
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


class StaffInvitationOperationSerializer(serializers.ModelSerializer[Invitation]):
    theme_slug = serializers.CharField(source="theme.slug", read_only=True)
    package_code = serializers.CharField(
        source="package.code",
        read_only=True,
        allow_null=True,
    )
    client_email = serializers.CharField(
        source="client_user.email",
        read_only=True,
        allow_null=True,
    )
    order_reference = serializers.SerializerMethodField()
    order_status = serializers.SerializerMethodField()
    order_client_name = serializers.SerializerMethodField()

    class Meta:
        model = Invitation
        fields = [
            "public_slug",
            "theme_slug",
            "package_code",
            "status",
            "approval_status",
            "default_locale",
            "client_email",
            "order_reference",
            "order_status",
            "order_client_name",
            "published_at",
            "updated_at",
        ]

    def get_order_reference(self, obj: Invitation) -> str | None:
        order = getattr(obj, "order", None)
        return order.reference if order else None

    def get_order_status(self, obj: Invitation) -> str | None:
        order = getattr(obj, "order", None)
        return order.status if order else None

    def get_order_client_name(self, obj: Invitation) -> str:
        order = getattr(obj, "order", None)
        return order.client_name if order else ""


class PublicRSVPSerializer(serializers.Serializer):
    token = serializers.CharField(write_only=True)
    rsvp_status = serializers.ChoiceField(choices=Guest.RSVPStatus.choices)
    attendance_count = serializers.IntegerField(min_value=0)
    wishes = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate(self, attrs):
        if attrs["rsvp_status"] == Guest.RSVPStatus.DECLINED and attrs["attendance_count"] != 0:
            raise serializers.ValidationError({"attendance_count": "Declined RSVP must use 0."})
        return attrs


class PublicGuestRSVPCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    contact = serializers.CharField(max_length=120, required=False, allow_blank=True)
    rsvp_status = serializers.ChoiceField(choices=Guest.RSVPStatus.choices)
    attendance_count = serializers.IntegerField(min_value=0)
    message = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate(self, attrs):
        if attrs["rsvp_status"] == Guest.RSVPStatus.DECLINED and attrs["attendance_count"] != 0:
            raise serializers.ValidationError({"attendance_count": "Declined RSVP must use 0."})
        return attrs


class GuestAggregateSerializer(serializers.Serializer):
    wedding_id = serializers.CharField()
    total_invited = serializers.IntegerField()
    total_confirmed = serializers.IntegerField()
    total_declined = serializers.IntegerField()
    response_rate = serializers.FloatField()


class BacksoundAssetSerializer(serializers.ModelSerializer[MediaAsset]):
    class Meta:
        model = MediaAsset
        fields = [
            "id",
            "public_id",
            "resource_type",
            "format",
            "secure_url",
            "original_filename",
        ]


class InvitationBacksoundSerializer(serializers.ModelSerializer[InvitationMedia]):
    asset = BacksoundAssetSerializer(read_only=True)

    class Meta:
        model = InvitationMedia
        fields = ["id", "role", "asset", "sort_order", "updated_at"]

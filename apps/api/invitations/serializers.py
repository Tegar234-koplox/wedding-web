from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from common.models import AuditEvent
from invitations.models import EventLocation, Guest, Invitation, WeddingEvent
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


class ClientInvitationSerializer(serializers.ModelSerializer[Invitation]):
    theme_slug = serializers.CharField(source="theme.slug", read_only=True)
    package_code = serializers.CharField(
        source="package.code",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Invitation
        fields = [
            "public_slug",
            "theme_slug",
            "package_code",
            "status",
            "approval_status",
            "default_locale",
            "content",
            "updated_at",
        ]
        read_only_fields = [
            "public_slug",
            "theme_slug",
            "package_code",
            "status",
            "approval_status",
            "updated_at",
        ]

    def validate_content(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Invitation content must be an object.")
        return value

    def validate(self, attrs):
        locked_statuses = {
            Invitation.ApprovalStatus.APPROVED_FOR_PUBLISH,
            Invitation.ApprovalStatus.PUBLISHED,
        }
        if self.instance and self.instance.approval_status in locked_statuses:
            raise serializers.ValidationError(
                {"content": "Approved invitations cannot be edited by the client."}
            )
        return attrs

    def update(self, instance, validated_data):
        invitation = super().update(instance, validated_data)
        request = self.context.get("request")
        if request is not None:
            AuditEvent.objects.create(
                actor=request.user,
                action="invitation.client_updated",
                resource_type="invitation",
                resource_reference=invitation.public_slug,
                metadata={"fields": sorted(validated_data.keys())},
            )
        return invitation


class GuestSerializer(serializers.ModelSerializer[Guest]):
    class Meta:
        model = Guest
        fields = [
            "display_name",
            "email",
            "phone",
            "party_size",
            "rsvp_status",
            "attendance_count",
            "wishes",
            "responded_at",
            "retention_expires_at",
        ]
        read_only_fields = ["responded_at", "retention_expires_at"]


class PublicRSVPSerializer(serializers.Serializer):
    token = serializers.CharField(write_only=True)
    rsvp_status = serializers.ChoiceField(choices=Guest.RSVPStatus.choices)
    attendance_count = serializers.IntegerField(min_value=0)
    wishes = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate(self, attrs):
        if attrs["rsvp_status"] == Guest.RSVPStatus.DECLINED and attrs["attendance_count"] != 0:
            raise serializers.ValidationError({"attendance_count": "Declined RSVP must use 0."})
        return attrs

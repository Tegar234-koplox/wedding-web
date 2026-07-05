from django.contrib.auth.hashers import check_password
from django.utils import timezone
from django.utils.crypto import constant_time_compare
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
    content = serializers.SerializerMethodField()
    guest = serializers.SerializerMethodField()

    def _guest_matches_token(self, guest, token: str) -> bool:
        stored = guest.access_token_hash
        if stored.startswith(("pbkdf2_", "argon2", "bcrypt", "md5$")):
            return check_password(token, stored)
        return constant_time_compare(stored, token)

    def get_guest(self, obj: Invitation) -> dict[str, object] | None:
        request = self.context.get("request")
        token = request.query_params.get("guest", "").strip() if request else ""
        if not token:
            return None
        guest = next(
            (
                item
                for item in obj.guests.all()
                if item.archived_at is None
                and item.anonymized_at is None
                and self._guest_matches_token(item, token)
            ),
            None,
        )
        if guest is None:
            return None
        return {"displayName": guest.display_name}

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

    def get_content(self, obj: Invitation) -> dict[str, object]:
        content = obj.content if isinstance(obj.content, dict) else {}
        order = getattr(obj, "order", None)
        couple = content.get("couple") if isinstance(content.get("couple"), dict) else {}
        event = content.get("event") if isinstance(content.get("event"), dict) else {}
        story = content.get("story") if isinstance(content.get("story"), dict) else {}
        quote = content.get("quote") if isinstance(content.get("quote"), dict) else {}
        opening = content.get("opening") if isinstance(content.get("opening"), dict) else {}
        closing = content.get("closing") if isinstance(content.get("closing"), dict) else {}
        partner_one = str(
            couple.get("partnerOne")
            or couple.get("partner_one")
            or getattr(order, "client_name", "")
        ).strip()
        partner_two = str(couple.get("partnerTwo") or couple.get("partner_two") or "").strip()
        monogram = str(couple.get("monogram") or "").strip()
        if not monogram:
            initials = [name[:1] for name in [partner_one, partner_two] if name]
            monogram = "&".join(initials) or "N"
        ceremony = obj.events.filter(event_type=WeddingEvent.EventType.CEREMONY).first()
        reception = obj.events.filter(event_type=WeddingEvent.EventType.RECEPTION).first()
        primary_event = ceremony or reception
        local_event_time = timezone.localtime(primary_event.starts_at) if primary_event else None
        date_label = local_event_time.strftime("%d %B %Y") if local_event_time else "Tanggal acara"
        ceremony_time = (
            timezone.localtime(ceremony.starts_at).strftime("%H.%M") if ceremony else "Waktu akad"
        )
        reception_time = (
            timezone.localtime(reception.starts_at).strftime("%H.%M")
            if reception
            else "Waktu resepsi"
        )
        venue = event.get("venue") or getattr(primary_event, "venue_name", "") or "Nama Venue"
        address = event.get("address") or getattr(primary_event, "address", "") or "Alamat venue"
        gallery = content.get("gallery")
        if not isinstance(gallery, list) or not 3 <= len(gallery) <= 12:
            gallery = [
                {"src": "/images/hero-editorial.webp", "alt": "Portrait of the couple"},
                {"src": "/images/themes/elegant-classic.webp", "alt": "Invitation detail"},
                {"src": "/images/themes/dark-cinematic.webp", "alt": "Editorial detail"},
            ]

        return {
            **content,
            "couple": {
                "partnerOne": partner_one or "Nama Pasangan",
                "partnerTwo": partner_two or "Nama Pasangan",
                "monogram": monogram[:8],
            },
            "opening": {
                "eyebrow": opening.get("eyebrow") or "Dengan penuh sukacita",
                "title": opening.get("title") or "Kami mengundang Anda",
                "message": opening.get("message") or "Untuk hadir di hari pernikahan kami.",
            },
            "event": {
                "dateLabel": event.get("dateLabel") or date_label,
                "ceremonyLabel": event.get("ceremonyLabel") or "Akad",
                "ceremonyTime": event.get("ceremonyTime") or ceremony_time,
                "receptionLabel": event.get("receptionLabel") or "Resepsi",
                "receptionTime": event.get("receptionTime") or reception_time,
                "venue": venue,
                "address": address,
                "mapUrl": event.get("mapUrl")
                or getattr(primary_event, "map_url", "")
                or "https://maps.google.com",
            },
            "story": {
                "heading": story.get("heading") or "Cerita kami",
                "body": story.get("body") or "Kami bertemu dan bertumbuh bersama.",
            },
            "quote": {
                "text": quote.get("text")
                or (
                    "Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan "
                    "pasangan-pasangan untukmu."
                ),
                "attribution": quote.get("attribution") or "Ar-Rum - 21",
            },
            "gallery": gallery,
            "closing": {
                "heading": closing.get("heading") or "Sampai bertemu",
                "message": closing.get("message") or "Terima kasih atas doa dan restunya.",
            },
        }

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
            "guest",
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


class StaffGuestLinkCreateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=120)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    party_size = serializers.IntegerField(min_value=1, max_value=20, default=1)


class StaffGuestLinkSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    display_name = serializers.CharField()
    email = serializers.EmailField(allow_blank=True)
    phone = serializers.CharField(allow_blank=True)
    party_size = serializers.IntegerField()
    rsvp_status = serializers.CharField()
    attendance_count = serializers.IntegerField()
    responded_at = serializers.DateTimeField(allow_null=True)
    delivery_url = serializers.CharField(allow_blank=True, allow_null=True)
    token_available = serializers.BooleanField()
    created_at = serializers.DateTimeField()


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

import re

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


def _couple_from_client_name(client_name: str) -> tuple[str, str]:
    name = client_name.strip()
    if not name:
        return "", ""
    parts = [
        part.strip()
        for part in re.split(r"\s+(?:dan|and)\s+|\s*&\s*|\s*\+\s*", name, maxsplit=1, flags=re.I)
        if part.strip()
    ]
    if len(parts) >= 2:
        return parts[0], parts[1]
    return name, ""


def _content_or_fallback(value: object, fallback: str, placeholders: set[str]) -> str:
    text = str(value or "").strip()
    if not text or text in placeholders:
        return fallback
    return text


def _schedule_or_fallback(value: object, fallback: str, placeholders: set[str]) -> str:
    text = _content_or_fallback(value, fallback, placeholders)
    if text == fallback:
        return fallback
    if not re.search(r"\b\d{4}\b", text):
        return fallback
    return text


ID_DAYS = {
    0: "Senin",
    1: "Selasa",
    2: "Rabu",
    3: "Kamis",
    4: "Jumat",
    5: "Sabtu",
    6: "Minggu",
}

ID_MONTHS = {
    1: "Januari",
    2: "Februari",
    3: "Maret",
    4: "April",
    5: "Mei",
    6: "Juni",
    7: "Juli",
    8: "Agustus",
    9: "September",
    10: "Oktober",
    11: "November",
    12: "Desember",
}


THEME_STORIES = {
    "elegant-classic": {
        "id": (
            "Kami bertemu di antara rak-rak buku dan percakapan yang seharusnya singkat. "
            "Lima tahun kemudian, kami masih memilih percakapan yang sama—kini untuk "
            "seumur hidup."
        ),
        "en": (
            "We met between bookshelves and a conversation meant to be brief. Five years "
            "later, we are still choosing that same conversation—now for a lifetime."
        ),
    },
    "islamic-soft": {
        "id": (
            "Dengan niat yang baik, doa kedua keluarga, dan hati yang dipertemukan pada "
            "waktu yang tepat, kami melangkah menuju ibadah terpanjang bersama."
        ),
        "en": (
            "With sincere intention, our families' prayers, and two hearts meeting at the "
            "right time, we begin our longest act of devotion together."
        ),
    },
    "luxury-gold": {
        "id": (
            "Dari dua kota dan dua ritme hidup yang berbeda, kami menemukan rumah dalam "
            "keberanian satu sama lain. Malam ini, kisah itu menjadi perayaan."
        ),
        "en": (
            "From two cities and two different rhythms, we found home in each other's "
            "courage. Tonight, that story becomes a celebration."
        ),
    },
    "minimalist-white": {
        "id": (
            "Tidak ada momen besar pada pertemuan pertama kami. Hanya rasa tenang, "
            "secangkir kopi, dan keyakinan kecil bahwa kami ingin bertemu lagi."
        ),
        "en": (
            "There was no grand moment when we first met. Only calm, a cup of coffee, and "
            "the quiet certainty that we wanted to meet again."
        ),
    },
    "dark-cinematic": {
        "id": (
            "Kisah kami tidak dimulai dengan sempurna. Ia tumbuh melalui jarak, "
            "keberanian, dan keputusan untuk terus kembali—sampai pulang berarti satu "
            "sama lain."
        ),
        "en": (
            "Our story did not begin perfectly. It grew through distance, courage, and the "
            "choice to keep returning—until home meant one another."
        ),
    },
    "floral-romantic": {
        "id": (
            "Sebuah pertemanan lama berubah perlahan menjadi tempat paling hangat. Kami "
            "bertumbuh, berpindah, dan akhirnya memilih mekar di musim yang sama."
        ),
        "en": (
            "An old friendship slowly became our warmest place. We grew, wandered, and "
            "finally chose to bloom in the same season."
        ),
    },
    "javanese-traditional": {
        "id": (
            "Dibesarkan oleh nilai yang sama, kami belajar bahwa cinta juga berarti "
            "ngugemi janji—merawat yang diwariskan sambil membangun rumah untuk masa "
            "depan."
        ),
        "en": (
            "Raised by shared values, we learned that love also means keeping a promise—"
            "honoring what came before while building a home for the future."
        ),
    },
}

GENERIC_STORY_BODIES = {
    "",
    "Kami bertemu dan bertumbuh bersama.",
    "We met and grew together.",
}


def _event_schedule_label(event: WeddingEvent | None, locale: str, fallback: str) -> str:
    if event is None:
        return fallback
    local_time = timezone.localtime(event.starts_at)
    if locale == "id":
        day = ID_DAYS[local_time.weekday()]
        month = ID_MONTHS[local_time.month]
        date = f"{day}, {local_time.day} {month} {local_time.year}"
    else:
        date = local_time.strftime("%A, %d %B %Y")
    return f"{date}, {local_time.strftime('%I.%M %p')}"


def _theme_story_body(invitation: Invitation) -> str:
    locale = invitation.default_locale if invitation.default_locale in {"id", "en"} else "id"
    theme_key = invitation.renderer_key or getattr(invitation.theme, "renderer_key", "")
    return THEME_STORIES.get(theme_key, THEME_STORIES["elegant-classic"])[locale]


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
        order_client_name = str(getattr(order, "client_name", "") or "")
        parsed_partner_one, parsed_partner_two = _couple_from_client_name(order_client_name)
        partner_one = str(
            couple.get("partnerOne") or couple.get("partner_one") or parsed_partner_one
        ).strip()
        partner_two = str(couple.get("partnerTwo") or couple.get("partner_two") or "").strip()
        if (
            partner_one == order_client_name
            and partner_two in {"", "Nama Pasangan"}
            and parsed_partner_two
        ):
            partner_one = parsed_partner_one
            partner_two = parsed_partner_two
        elif partner_two in {"", "Nama Pasangan"} and parsed_partner_two:
            partner_two = parsed_partner_two
        monogram = str(couple.get("monogram") or "").strip()
        if not monogram:
            initials = [name[:1] for name in [partner_one, partner_two] if name]
            monogram = "&".join(initials) or "N"
        ceremony = obj.events.filter(event_type=WeddingEvent.EventType.CEREMONY).first()
        reception = obj.events.filter(event_type=WeddingEvent.EventType.RECEPTION).first()
        primary_event = ceremony or reception
        date_label = "Akad dan Resepsi" if obj.default_locale == "id" else "Ceremony and Reception"
        ceremony_time = _event_schedule_label(ceremony, obj.default_locale, "Waktu akad")
        reception_time = _event_schedule_label(reception, obj.default_locale, "Waktu resepsi")
        venue = _content_or_fallback(
            event.get("venue"),
            getattr(primary_event, "venue_name", "") or "Nama Venue",
            {"Nama Venue", "Nama venue"},
        )
        address = _content_or_fallback(
            event.get("address"),
            getattr(primary_event, "address", "") or "Alamat venue",
            {"Alamat Venue", "Alamat venue"},
        )
        map_url = _content_or_fallback(
            event.get("mapUrl"),
            getattr(primary_event, "map_url", "") or "https://maps.google.com",
            {"https://maps.google.com", "https://maps.google.com/"},
        )
        gallery = content.get("gallery")
        if not isinstance(gallery, list) or not 3 <= len(gallery) <= 18:
            gallery = [
                {"src": "/images/hero-editorial.webp", "alt": "Portrait of the couple"},
                {"src": "/images/themes/elegant-classic.webp", "alt": "Invitation detail"},
                {"src": "/images/themes/dark-cinematic.webp", "alt": "Editorial detail"},
            ]
        story_body = str(story.get("body") or "").strip()
        if story_body in GENERIC_STORY_BODIES:
            story_body = _theme_story_body(obj)

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
                "dateLabel": date_label,
                "ceremonyLabel": event.get("ceremonyLabel") or "Akad",
                "ceremonyTime": _schedule_or_fallback(
                    event.get("ceremonyTime"),
                    ceremony_time,
                    {"Waktu akad", "Waktu Akad", "09.00 WIB", "08.00"},
                ),
                "receptionLabel": event.get("receptionLabel") or "Resepsi",
                "receptionTime": _schedule_or_fallback(
                    event.get("receptionTime"),
                    reception_time,
                    {"Waktu resepsi", "Waktu Resepsi", "11.00-14.00 WIB", "08.00"},
                ),
                "venue": venue,
                "address": address,
                "mapUrl": map_url,
            },
            "story": {
                "heading": story.get("heading") or "Cerita kami",
                "body": story_body,
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


class StaffGuestLinkImportRowSerializer(serializers.Serializer):
    row_number = serializers.IntegerField()
    name = serializers.CharField(allow_blank=True)
    phone = serializers.CharField(allow_blank=True)
    email = serializers.EmailField(allow_blank=True, required=False)
    party_size = serializers.IntegerField()
    group = serializers.CharField(allow_blank=True)
    note = serializers.CharField(allow_blank=True)
    status = serializers.CharField()
    action = serializers.CharField()
    errors = serializers.ListField(child=serializers.CharField())
    warnings = serializers.ListField(child=serializers.CharField())
    matched_guest_id = serializers.UUIDField(allow_null=True)
    delivery_url = serializers.CharField(allow_blank=True, allow_null=True)


class StaffGuestLinkImportSerializer(serializers.Serializer):
    summary = serializers.DictField()
    rows = StaffGuestLinkImportRowSerializer(many=True)


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

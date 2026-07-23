from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from catalog.models import (
    Package,
    PackageFeature,
    PackageTranslation,
    Theme,
    ThemeTranslation,
)
from invitations.models import EventLocation, Invitation, WeddingEvent

THEMES = [
    ("elegant-classic", "Klasik Modern", "Elegant Classic"),
    ("islamic-soft", "Tenang & Sakral", "Islamic Soft"),
    ("luxury-gold", "Mewah Terkurasi", "Luxury Gold"),
    ("minimalist-white", "Hening Modern", "Minimalist White"),
    ("dark-cinematic", "Dramatis & Intim", "Dark Cinematic"),
    ("floral-romantic", "Botanikal Editorial", "Floral Romantic"),
    ("javanese-traditional", "Warisan Kontemporer", "Javanese / Traditional"),
]

PACKAGES = [
    ("essential", 99000, False),
    ("signature", 249000, True),
    ("couture", 549000, False),
]

PACKAGE_FEATURES = {
    "essential": [
        ("theme", "1 tema pilihan", "1 selected theme"),
        ("event-info", "Informasi acara", "Event details"),
        ("location-map", "Peta lokasi", "Location map"),
        ("gift", "Gift", "Gift"),
        ("backsound", "Musik latar belakang", "Background music"),
    ],
    "signature": [
        ("essential", "Semua fitur Essential", "Everything in Essential"),
        ("story-timeline", "Love story & timeline", "Love story & timeline"),
        ("rsvp-wishes", "RSVP dan ucapan", "RSVP and wishes"),
        (
            "weather",
            "Prakiraan cuaca di lokasi acara",
            "Weather forecast at the event location",
        ),
    ],
    "couture": [
        ("signature", "Semua fitur Signature", "Everything in Signature"),
        ("complexity-design", "Kompleksitas desain dan motion", "Complexity of design and motion"),
        (
            "vivid-display",
            "Tampilan lebih hidup",
            "More vivid display",
        ),
        ("story-details", "Detail love story dan timeline", "Love story details and timeline"),
    ],
}

PACKAGE_SUMMARIES = {
    "essential": {
        "id": "Untuk pasangan yang membutuhkan undangan digital rapi dan personal.",
        "en": "For couples who need a neat and personal digital invitation.",
    },
    "signature": {
        "id": "Pengalaman lengkap dengan cerita, RSVP, dan sentuhan editorial.",
        "en": "A complete experience with story, RSVP, and editorial touches.",
    },
    "couture": {
        "id": "Desain lebih kompleks untuk perayaan yang ingin tampil benar-benar berbeda.",
        "en": "More complex designs for celebrations that want to be truly different.",
    },
}


def sample_content(partner_one: str, partner_two: str) -> dict[str, object]:
    return {
        "couple": {
            "partnerOne": partner_one,
            "partnerTwo": partner_two,
            "monogram": f"{partner_one[0]}&{partner_two[0]}",
        },
        "opening": {
            "eyebrow": "Dengan penuh sukacita",
            "title": "Kami mengundang Anda",
            "message": "Untuk hadir dan menjadi bagian dari hari pernikahan kami.",
        },
        "event": {
            "dateLabel": "Sabtu, 12 September 2026",
            "ceremonyLabel": "Akad Nikah",
            "ceremonyTime": "09.00 WIB",
            "receptionLabel": "Resepsi",
            "receptionTime": "11.00–14.00 WIB",
            "venue": "The Venue",
            "address": "Jakarta, Indonesia",
            "mapUrl": "https://maps.google.com",
        },
        "story": {
            "heading": "Tentang perjalanan kami",
            "body": "Kami bertemu, bertumbuh, dan memilih untuk melanjutkan perjalanan bersama.",
        },
        "quote": {
            "text": "Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan.",
            "attribution": "Ar-Rum · 21",
        },
        "gallery": [
            {"src": "/images/hero-editorial.webp", "alt": "Portrait of the couple"},
            {"src": "/images/themes/elegant-classic.webp", "alt": "Invitation detail"},
            {"src": "/images/themes/dark-cinematic.webp", "alt": "Editorial detail"},
        ],
        "closing": {
            "heading": "Sampai bertemu",
            "message": "Kehadiran dan doa Anda sangat berarti bagi kami.",
        },
    }


class Command(BaseCommand):
    help = "Create idempotent demo themes, packages, and sample invitations."

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        for index, (slug, category, name) in enumerate(THEMES):
            theme, _ = Theme.objects.update_or_create(
                slug=slug,
                defaults={
                    "renderer_key": slug,
                    "renderer_version": 2,
                    "content_schema_version": 1,
                    "status": Theme.Status.PUBLISHED,
                    "category": category,
                    "sort_order": index,
                    "is_featured": index < 3,
                },
            )
            ThemeTranslation.objects.update_or_create(
                theme=theme,
                locale="id",
                defaults={
                    "name": name,
                    "tagline": category,
                    "description": f"Tema {name} yang dirancang secara editorial.",
                    "feature_copy": ["Responsive", "Gallery", "Event details"],
                },
            )
            ThemeTranslation.objects.update_or_create(
                theme=theme,
                locale="en",
                defaults={
                    "name": name,
                    "tagline": category,
                    "description": f"An editorial {name} wedding invitation theme.",
                    "feature_copy": ["Responsive", "Gallery", "Event details"],
                },
            )
            invitation, _ = Invitation.objects.update_or_create(
                public_slug=f"sample-{slug}",
                defaults={
                    "theme": theme,
                    "renderer_key": slug,
                    "renderer_version": 2,
                    "content_schema_version": 1,
                    "status": Invitation.Status.PUBLISHED,
                    "is_sample": True,
                    "published_at": timezone.now(),
                    "content": sample_content("Alya", "Raka"),
                },
            )
            event, _ = WeddingEvent.objects.update_or_create(
                invitation=invitation,
                event_type=WeddingEvent.EventType.CEREMONY,
                defaults={
                    "starts_at": datetime(
                        2026,
                        9,
                        12,
                        9,
                        0,
                        tzinfo=ZoneInfo("Asia/Jakarta"),
                    ),
                    "timezone": "Asia/Jakarta",
                    "venue_name": "The Venue",
                    "address": "Kemayoran, Jakarta Pusat",
                    "map_url": "https://maps.google.com",
                },
            )
            EventLocation.objects.update_or_create(
                event=event,
                defaults={
                    "province": "DKI Jakarta",
                    "regency": "Kota Adm. Jakarta Pusat",
                    "district": "Kemayoran",
                    "village": "Kemayoran",
                    "bmkg_adm4": "31.71.03.1001",
                    "latitude": "-6.164721",
                    "longitude": "106.845384",
                },
            )

        for index, (code, price, featured) in enumerate(PACKAGES):
            package, _ = Package.objects.update_or_create(
                code=code,
                defaults={
                    "price": price,
                    "currency": "IDR",
                    "is_active": True,
                    "is_featured": featured,
                    "sort_order": index,
                },
            )
            PackageTranslation.objects.update_or_create(
                package=package,
                locale="id",
                defaults={
                    "name": code.title(),
                    "summary": PACKAGE_SUMMARIES[code]["id"],
                },
            )
            PackageTranslation.objects.update_or_create(
                package=package,
                locale="en",
                defaults={
                    "name": code.title(),
                    "summary": PACKAGE_SUMMARIES[code]["en"],
                },
            )
            feature_keys = []
            for feature_index, (feature_key, label_id, label_en) in enumerate(
                PACKAGE_FEATURES[code]
            ):
                feature_keys.append(feature_key)
                PackageFeature.objects.update_or_create(
                    package=package,
                    feature_key=feature_key,
                    defaults={
                        "is_included": True,
                        "labels": {"id": label_id, "en": label_en},
                        "sort_order": feature_index,
                    },
                )
            package.features.exclude(feature_key__in=feature_keys).delete()

        signature = Package.objects.get(code="signature")
        Invitation.objects.filter(is_sample=True).update(package=signature)

        self.stdout.write(self.style.SUCCESS("Demo content is ready."))

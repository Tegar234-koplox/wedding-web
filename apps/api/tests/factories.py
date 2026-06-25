from __future__ import annotations

from typing import Any

from django.utils import timezone

from catalog.models import (
    Package,
    PackageFeature,
    PackageTranslation,
    Theme,
    ThemeTranslation,
)
from invitations.models import EventLocation, Guest, Invitation, WeddingEvent


def invitation_content() -> dict[str, Any]:
    return {
        "couple": {
            "partnerOne": "Alya",
            "partnerTwo": "Raka",
            "monogram": "A&R",
        },
        "opening": {
            "eyebrow": "Dengan penuh sukacita",
            "title": "Kami mengundang Anda",
            "message": "Untuk hadir di hari pernikahan kami.",
        },
        "event": {
            "dateLabel": "12 September 2026",
            "ceremonyLabel": "Akad",
            "ceremonyTime": "09.00 WIB",
            "receptionLabel": "Resepsi",
            "receptionTime": "11.00 WIB",
            "venue": "The Venue",
            "address": "Jakarta",
            "mapUrl": "https://maps.google.com",
        },
        "story": {"heading": "Cerita kami", "body": "Kami bertemu dan bertumbuh bersama."},
        "quote": {"text": "A meaningful quote.", "attribution": "Us"},
        "gallery": [
            {"src": "/images/one.webp", "alt": "One"},
            {"src": "/images/two.webp", "alt": "Two"},
            {"src": "/images/three.webp", "alt": "Three"},
        ],
        "closing": {"heading": "Sampai bertemu", "message": "Terima kasih."},
    }


def create_theme(
    *,
    slug: str = "elegant-classic",
    status: str = Theme.Status.PUBLISHED,
) -> Theme:
    theme = Theme.objects.create(
        slug=slug,
        renderer_key=slug,
        renderer_version=2,
        content_schema_version=1,
        status=status,
        category="classic",
        is_featured=True,
    )
    ThemeTranslation.objects.create(
        theme=theme,
        locale="id",
        name="Elegan Klasik",
        tagline="Tak lekang waktu",
        description="Tema klasik yang editorial.",
        feature_copy=["Tipografi serif"],
    )
    ThemeTranslation.objects.create(
        theme=theme,
        locale="en",
        name="Elegant Classic",
        tagline="Timeless",
        description="An editorial classic theme.",
        feature_copy=["Serif typography"],
    )
    return theme


def create_package() -> Package:
    package = Package.objects.create(
        code="signature",
        price="649000",
        currency="IDR",
        is_active=True,
        is_featured=True,
    )
    PackageTranslation.objects.create(
        package=package,
        locale="id",
        name="Signature",
        summary="Pengalaman lengkap.",
    )
    PackageFeature.objects.create(
        package=package,
        feature_key="weather",
        labels={"id": "Cuaca BMKG", "en": "BMKG Weather"},
    )
    return package


def create_invitation(
    *,
    theme: Theme,
    status: str = Invitation.Status.PUBLISHED,
    public_slug: str = "alya-raka",
    is_sample: bool = True,
) -> Invitation:
    invitation = Invitation.objects.create(
        public_slug=public_slug,
        theme=theme,
        renderer_key=theme.renderer_key,
        renderer_version=theme.renderer_version,
        content_schema_version=1,
        status=status,
        is_sample=is_sample,
        published_at=timezone.now() if status == Invitation.Status.PUBLISHED else None,
        content=invitation_content(),
    )
    Guest.objects.create(
        invitation=invitation,
        access_token_hash=f"secret-{public_slug}",
        display_name="Private Guest",
    )
    return invitation


def create_weather_event(
    *,
    invitation: Invitation,
    starts_at,
    adm4: str = "31.71.03.1001",
) -> WeddingEvent:
    event = WeddingEvent.objects.create(
        invitation=invitation,
        event_type=WeddingEvent.EventType.CEREMONY,
        starts_at=starts_at,
        timezone="Asia/Jakarta",
        venue_name="The Venue",
        address="Jakarta",
    )
    EventLocation.objects.create(
        event=event,
        province="DKI Jakarta",
        regency="Kota Adm. Jakarta Pusat",
        district="Kemayoran",
        village="Kemayoran",
        bmkg_adm4=adm4,
        latitude="-6.164721",
        longitude="106.845384",
    )
    return event

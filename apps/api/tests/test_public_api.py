from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from catalog.models import Theme, ThemeMedia
from invitations.models import Invitation, InvitationMedia, WeddingEvent
from invitations.preview import preview_token_for
from media_library.models import MediaAsset
from tests.factories import create_invitation, create_package, create_theme


@pytest.mark.django_db
def test_theme_list_is_localized_and_hides_drafts(client):
    create_theme()
    create_theme(slug="dark-cinematic", status=Theme.Status.DRAFT)

    response = client.get(reverse("theme-list"), {"locale": "en"})

    assert response.status_code == 200
    assert response.json()["count"] == 1
    result = response.json()["results"][0]
    assert result["slug"] == "elegant-classic"
    assert result["name"] == "Elegant Classic"
    assert "id" not in result


@pytest.mark.django_db
def test_package_list_returns_public_features(client):
    create_package()

    response = client.get(reverse("package-list"), {"locale": "id"})

    assert response.status_code == 200
    payload = response.json()
    assert {item["code"] for item in payload} == {"essential", "signature", "couture"}
    signature = next(item for item in payload if item["code"] == "signature")
    assert signature["features"][4]["label"] == "Prakiraan cuaca di lokasi acara"


@pytest.mark.django_db
def test_couture_package_uses_latest_catalog_copy(client):
    response = client.get(reverse("package-list"), {"locale": "id"})

    assert response.status_code == 200
    couture = next(item for item in response.json() if item["code"] == "couture")
    assert couture["summary"] == (
        "Desain lebih kompleks untuk perayaan yang ingin tampil benar-benar berbeda."
    )
    assert [feature["label"] for feature in couture["features"]] == [
        "Semua fitur Signature",
        "Kompleksitas desain dan motion",
        "Tampilan lebih hidup",
        "Detail love story dan timeline",
        "Revisi 8 kali",
        "Galeri +4 foto dari paket Signature",
    ]


@pytest.mark.django_db
def test_published_invitation_does_not_leak_guests_or_internal_ids(client):
    theme = create_theme()
    invitation = create_invitation(theme=theme)

    response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["public_slug"] == invitation.public_slug
    assert "id" not in payload
    assert "guests" not in payload
    assert "access_token_hash" not in response.content.decode()


@pytest.mark.django_db
def test_public_invitation_keeps_event_locations_separate(client):
    theme = create_theme()
    invitation = create_invitation(theme=theme)
    starts_at = timezone.now() + timedelta(days=7)
    WeddingEvent.objects.create(
        invitation=invitation,
        event_type=WeddingEvent.EventType.CEREMONY,
        starts_at=starts_at,
        venue_name="Masjid Akad",
        address="Jalan Akad 1",
        map_url="https://maps.google.com/?q=ceremony",
    )
    WeddingEvent.objects.create(
        invitation=invitation,
        event_type=WeddingEvent.EventType.RECEPTION,
        starts_at=starts_at + timedelta(hours=3),
        venue_name="Gedung Resepsi",
        address="Jalan Resepsi 2",
        map_url="https://maps.google.com/?q=reception",
    )

    response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )

    assert response.status_code == 200
    event = response.json()["content"]["event"]
    assert event["ceremonyVenue"] == "Masjid Akad"
    assert event["ceremonyAddress"] == "Jalan Akad 1"
    assert event["ceremonyMapUrl"] == "https://maps.google.com/?q=ceremony"
    assert event["receptionVenue"] == "Gedung Resepsi"
    assert event["receptionAddress"] == "Jalan Resepsi 2"
    assert event["receptionMapUrl"] == "https://maps.google.com/?q=reception"


@pytest.mark.django_db
def test_draft_invitation_is_not_public(client):
    theme = create_theme()
    invitation = create_invitation(
        theme=theme,
        status=Invitation.Status.DRAFT,
        public_slug="draft-invitation",
    )

    response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_draft_invitation_preview_requires_valid_token(client):
    theme = create_theme()
    invitation = create_invitation(
        theme=theme,
        status=Invitation.Status.DRAFT,
        public_slug="draft-preview",
    )

    invalid_response = client.get(
        reverse("invitation-preview-detail", kwargs={"public_slug": invitation.public_slug}),
        {"token": "wrong"},
    )
    valid_response = client.get(
        reverse("invitation-preview-detail", kwargs={"public_slug": invitation.public_slug}),
        {"token": preview_token_for(invitation)},
    )

    assert invalid_response.status_code == 404
    assert valid_response.status_code == 200
    assert valid_response.json()["public_slug"] == invitation.public_slug


@pytest.mark.django_db
def test_theme_sample_uses_published_sample_only(client):
    theme = create_theme()
    create_invitation(theme=theme, is_sample=True)

    response = client.get(reverse("theme-sample", kwargs={"slug": theme.slug}))

    assert response.status_code == 200
    assert response.json()["rendererKey"] == "elegant-classic"
    assert response.json()["rendererVersion"] == 2


@pytest.mark.django_db
def test_public_invitation_exposes_allowlisted_cloudinary_audio(client):
    theme = create_theme()
    invitation = create_invitation(theme=theme)
    asset = MediaAsset.objects.create(
        public_id="wedding/invitations/alya-raka",
        resource_type=MediaAsset.ResourceType.VIDEO,
        format="mp3",
        secure_url="https://res.cloudinary.com/demo/video/upload/alya-raka.mp3",
        folder="wedding/invitations",
        original_filename="Our song",
    )
    InvitationMedia.objects.create(
        invitation=invitation,
        asset=asset,
        role=InvitationMedia.Role.BACKSOUND,
    )

    response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )

    assert response.status_code == 200
    assert response.json()["audio"] == {
        "secure_url": asset.secure_url,
        "title": "Our song",
        "loop": True,
        "default_volume": 0.35,
    }


@pytest.mark.django_db
def test_public_invitation_hides_untrusted_audio(client):
    theme = create_theme()
    invitation = create_invitation(theme=theme)
    asset = MediaAsset.objects.create(
        public_id="unsafe/audio",
        resource_type=MediaAsset.ResourceType.RAW,
        format="mp3",
        secure_url="https://example.com/audio.mp3",
        folder="wedding/invitations",
    )
    InvitationMedia.objects.create(
        invitation=invitation,
        asset=asset,
        role=InvitationMedia.Role.BACKSOUND,
    )

    response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )

    assert response.status_code == 200
    assert response.json()["audio"] is None


@pytest.mark.django_db
def test_sample_invitation_falls_back_to_theme_audio(client):
    theme = create_theme()
    invitation = create_invitation(theme=theme, is_sample=True)
    asset = MediaAsset.objects.create(
        public_id="wedding/themes/elegant-classic-preview",
        resource_type=MediaAsset.ResourceType.RAW,
        format="ogg",
        secure_url="https://res.cloudinary.com/demo/raw/upload/elegant-classic.ogg",
        folder="wedding/themes",
        original_filename="Elegant Classic Preview",
    )
    ThemeMedia.objects.create(
        theme=theme,
        asset=asset,
        role=ThemeMedia.Role.AUDIO,
    )

    response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )

    assert response.status_code == 200
    assert response.json()["audio"]["secure_url"] == asset.secure_url


@pytest.mark.django_db
def test_invalid_locale_returns_validation_error(client):
    create_theme()

    response = client.get(reverse("theme-list"), {"locale": "fr"})

    assert response.status_code == 400
    assert response.json()["error"]["status"] == 400


@pytest.mark.django_db
def test_weather_endpoint_exposes_safe_placeholder(client):
    theme = create_theme()
    invitation = create_invitation(theme=theme)

    response = client.get(
        reverse("invitation-weather", kwargs={"public_slug": invitation.public_slug})
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "unavailable",
        "reason": "location_unconfigured",
        "provider": "Open-Meteo",
        "attribution_url": "https://open-meteo.com/",
        "forecast": [],
    }

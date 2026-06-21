import pytest
from django.urls import reverse

from catalog.models import Theme
from invitations.models import Invitation
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
    assert response.json()[0]["code"] == "signature"
    assert response.json()[0]["features"][0]["label"] == "Cuaca BMKG"


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
def test_theme_sample_uses_published_sample_only(client):
    theme = create_theme()
    create_invitation(theme=theme, is_sample=True)

    response = client.get(reverse("theme-sample", kwargs={"slug": theme.slug}))

    assert response.status_code == 200
    assert response.json()["renderer_key"] == "elegant-classic"


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
        "reason": "outside_forecast_window",
        "provider": "BMKG",
        "forecast": [],
    }

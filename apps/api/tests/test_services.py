from unittest.mock import patch

import pytest
from django.core.exceptions import ValidationError
from django.test import override_settings
from django.urls import reverse

from leads.models import WhatsAppIntent
from leads.services import whatsapp_redirect_url
from media_library.services import create_upload_signature
from tests.factories import create_package, create_theme
from users.models import User


@pytest.mark.django_db
@override_settings(
    WHATSAPP_BUSINESS_NUMBER="+62 812-3456-7890",
    WHATSAPP_MESSAGE_TEMPLATE_ID="Halo dari Niskala.",
)
def test_whatsapp_redirect_validates_context_and_tracks_intent(client):
    create_theme()
    create_package()

    response = client.get(
        reverse("whatsapp-redirect"),
        {"locale": "id", "theme": "elegant-classic", "package": "signature"},
    )

    assert response.status_code == 302
    assert response.url.startswith("https://wa.me/6281234567890?")
    assert WhatsAppIntent.objects.filter(
        theme_slug="elegant-classic",
        package_code="signature",
    ).exists()


@pytest.mark.django_db
@override_settings(
    WHATSAPP_BUSINESS_NUMBER="6281234567890",
    WHATSAPP_MESSAGE_TEMPLATE_ID="Halo dari Niskala.",
)
def test_whatsapp_redirect_is_rate_limited(client):
    responses = [
        client.get(
            reverse("whatsapp-redirect"),
            {"locale": "id"},
            REMOTE_ADDR="198.51.100.25",
        )
        for _ in range(21)
    ]

    assert all(response.status_code == 302 for response in responses[:20])
    assert responses[20].status_code == 429


@pytest.mark.django_db
@override_settings(WHATSAPP_BUSINESS_NUMBER="6281234567890")
def test_whatsapp_service_rejects_unknown_theme():
    with pytest.raises(ValidationError):
        whatsapp_redirect_url(locale="id", theme_slug="unknown-theme")


@override_settings(
    CLOUDINARY_CLOUD_NAME="demo",
    CLOUDINARY_API_KEY="public-key",
    CLOUDINARY_API_SECRET="private-secret",
)
@patch("media_library.services.cloudinary.utils.api_sign_request", return_value="signature")
def test_cloudinary_signature_uses_allowlisted_folder(sign_request):
    payload = create_upload_signature(namespace="themes")

    assert payload["folder"] == "wedding/themes"
    assert payload["signature"] == "signature"
    sign_request.assert_called_once()


def test_cloudinary_signature_rejects_unknown_namespace():
    with pytest.raises(ValidationError):
        create_upload_signature(namespace="private")


@pytest.mark.django_db
@override_settings(
    CLOUDINARY_CLOUD_NAME="demo",
    CLOUDINARY_API_KEY="public-key",
    CLOUDINARY_API_SECRET="private-secret",
)
def test_upload_signature_requires_staff(client):
    response = client.post(
        reverse("upload-signature"),
        {"namespace": "themes"},
        content_type="application/json",
    )
    assert response.status_code in {401, 403}

    user = User.objects.create_user(
        username="staff",
        email="staff@example.com",
        password="safe-test-password",
        is_staff=True,
    )
    client.force_login(user)
    with patch(
        "media_library.services.cloudinary.utils.api_sign_request",
        return_value="signed",
    ):
        response = client.post(
            reverse("upload-signature"),
            {"namespace": "themes"},
            content_type="application/json",
        )
    assert response.status_code == 200
    assert response.json()["signature"] == "signed"

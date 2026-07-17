from uuid import UUID

import pytest
from django.test import override_settings
from django.urls import reverse


@pytest.mark.django_db
def test_liveness(client):
    response = client.get(reverse("health-live"))

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "environment": "development",
        "release": "local",
    }
    assert response.headers["X-Request-ID"]


@pytest.mark.django_db
def test_readiness(client):
    response = client.get(reverse("health-ready"))

    assert response.status_code == 200
    assert response.json()["checks"] == {"database": "ok", "cache": "ok"}


def test_request_id_accepts_safe_value(client):
    response = client.get(reverse("health-live"), headers={"X-Request-ID": "test-request.123"})

    assert response.headers["X-Request-ID"] == "test-request.123"


def test_request_id_replaces_unsafe_value(client):
    response = client.get(reverse("health-live"), headers={"X-Request-ID": "unsafe\nvalue"})

    UUID(response.headers["X-Request-ID"])


@override_settings(
    SECURE_SSL_REDIRECT=True,
    SECURE_REDIRECT_EXEMPT=[r"^health/(live|ready)$"],
)
def test_liveness_is_exempt_from_internal_ssl_redirect(client):
    response = client.get(reverse("health-live"), secure=False)

    assert response.status_code == 200


@override_settings(
    SECURE_SSL_REDIRECT=True,
    SECURE_REDIRECT_EXEMPT=[r"^health/(live|ready)$"],
)
def test_non_health_route_still_redirects_to_https(client):
    response = client.get(reverse("api-root"), secure=False)

    assert response.status_code == 301
    assert response.headers["Location"].startswith("https://")

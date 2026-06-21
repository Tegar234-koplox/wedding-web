from uuid import UUID

import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_liveness(client):
    response = client.get(reverse("health-live"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
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

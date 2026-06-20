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

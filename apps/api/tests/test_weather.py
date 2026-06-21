from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from tests.factories import create_invitation, create_theme, create_weather_event
from weather.exceptions import WeatherProviderError
from weather.models import WeatherFetchLog, WeatherSnapshot
from weather.normalizers import normalize_bmkg_payload
from weather.services import refresh_forecast, weather_for_invitation
from weather.tasks import schedule_upcoming_weather_refreshes


def bmkg_payload(event_at=None):
    event_at = event_at or timezone.now() + timedelta(hours=24)
    analysis_at = timezone.now().replace(minute=0, second=0, microsecond=0)
    return {
        "lokasi": {
            "adm4": "31.71.03.1001",
            "provinsi": "DKI Jakarta",
            "kotkab": "Kota Adm. Jakarta Pusat",
            "kecamatan": "Kemayoran",
            "desa": "Kemayoran",
            "lat": -6.1647,
            "lon": 106.8453,
            "timezone": "Asia/Jakarta",
        },
        "data": [
            {
                "cuaca": [
                    [
                        {
                            "datetime": event_at.isoformat(),
                            "local_datetime": event_at.astimezone().strftime("%Y-%m-%d %H:%M:%S"),
                            "analysis_date": analysis_at.isoformat(),
                            "t": 29,
                            "hu": 76,
                            "tcc": 55,
                            "tp": 0.5,
                            "weather": 61,
                            "weather_desc": "Hujan Ringan",
                            "weather_desc_en": "Light Rain",
                            "ws": 5.2,
                            "wd": "E",
                            "wd_to": "W",
                            "wd_deg": 90,
                            "vs": 8000,
                            "vs_text": "< 9 km",
                        }
                    ]
                ]
            }
        ],
    }


def test_normalizer_flattens_bmkg_groups():
    normalized = normalize_bmkg_payload(bmkg_payload())

    assert normalized["location"]["adm4"] == "31.71.03.1001"
    assert normalized["forecast"][0]["description"] == {
        "id": "Hujan Ringan",
        "en": "Light Rain",
    }
    assert normalized["forecast"][0]["temperature_c"] == 29


def test_normalizer_rejects_missing_forecast():
    with pytest.raises(WeatherProviderError) as exc:
        normalize_bmkg_payload({"lokasi": {}, "data": []})
    assert exc.value.category == "invalid_schema"


@pytest.mark.django_db
def test_weather_outside_window_does_not_call_provider():
    invitation = create_invitation(theme=create_theme())
    create_weather_event(
        invitation=invitation,
        starts_at=timezone.now() + timedelta(days=10),
    )

    with patch("weather.services.fetch_bmkg_forecast") as fetch:
        result = weather_for_invitation(invitation)

    assert result["reason"] == "outside_forecast_window"
    fetch.assert_not_called()


@pytest.mark.django_db
@override_settings(BMKG_CACHE_TTL_SECONDS=3600)
def test_refresh_persists_and_caches_normalized_snapshot():
    cache.clear()
    payload = bmkg_payload()

    with patch("weather.services.fetch_bmkg_forecast", return_value=payload) as fetch:
        first = refresh_forecast("31.71.03.1001")
        second = refresh_forecast("31.71.03.1001")

    assert first == second
    assert fetch.call_count == 1
    assert WeatherSnapshot.objects.count() == 1
    assert WeatherFetchLog.objects.filter(status="success").count() == 1


@pytest.mark.django_db
def test_weather_endpoint_returns_selected_forecast(client):
    cache.clear()
    event_at = timezone.now() + timedelta(hours=24)
    invitation = create_invitation(theme=create_theme())
    create_weather_event(invitation=invitation, starts_at=event_at)

    with patch(
        "weather.services.fetch_bmkg_forecast",
        return_value=bmkg_payload(event_at),
    ):
        response = client.get(
            reverse(
                "invitation-weather",
                kwargs={"public_slug": invitation.public_slug},
            )
        )

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["selected"]["description"]["en"] == "Light Rain"
    assert response.json()["attribution_url"].startswith("https://data.bmkg.go.id")


@pytest.mark.django_db
def test_provider_failure_uses_stale_snapshot():
    cache.clear()
    event_at = timezone.now() + timedelta(hours=24)
    invitation = create_invitation(theme=create_theme())
    create_weather_event(invitation=invitation, starts_at=event_at)

    with patch(
        "weather.services.fetch_bmkg_forecast",
        return_value=bmkg_payload(event_at),
    ):
        refresh_forecast("31.71.03.1001")
    cache.clear()

    with patch(
        "weather.services.fetch_bmkg_forecast",
        side_effect=WeatherProviderError("timeout", "Timed out"),
    ):
        result = weather_for_invitation(invitation)

    assert result["status"] == "stale"
    assert result["selected"]["temperature_c"] == 29


@pytest.mark.django_db
def test_scheduler_enqueues_distinct_upcoming_locations():
    cache.clear()
    invitation = create_invitation(theme=create_theme())
    create_weather_event(
        invitation=invitation,
        starts_at=timezone.now() + timedelta(hours=24),
    )

    with patch("weather.tasks.refresh_adm4_forecast.apply_async") as enqueue:
        count = schedule_upcoming_weather_refreshes()

    assert count == 1
    enqueue.assert_called_once_with(args=["31.71.03.1001"], countdown=0)

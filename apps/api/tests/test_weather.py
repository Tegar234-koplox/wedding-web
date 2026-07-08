from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from tests.factories import create_invitation, create_theme, create_weather_event
from weather.exceptions import WeatherProviderError
from weather.models import WeatherFetchLog, WeatherSnapshot
from weather.normalizers import normalize_open_meteo_payload
from weather.services import location_key, refresh_forecast, weather_for_invitation
from weather.tasks import schedule_upcoming_weather_refreshes


def open_meteo_payload(event_at=None):
    event_at = event_at or timezone.now() + timedelta(hours=24)
    local_at = event_at.astimezone(ZoneInfo("Asia/Jakarta")).strftime("%Y-%m-%dT%H:00")
    return {
        "latitude": -6.164721,
        "longitude": 106.845384,
        "timezone": "Asia/Jakarta",
        "utc_offset_seconds": 25200,
        "hourly": {
            "time": [local_at],
            "temperature_2m": [29],
            "relative_humidity_2m": [76],
            "cloud_cover": [55],
            "precipitation": [0.5],
            "weather_code": [61],
            "wind_speed_10m": [5.2],
            "wind_direction_10m": [90],
            "visibility": [8000],
        },
    }


def test_normalizer_flattens_open_meteo_hourly_forecast():
    normalized = normalize_open_meteo_payload(open_meteo_payload())

    assert normalized["location"]["provider"] == "Open-Meteo"
    assert normalized["forecast"][0]["description"] == {
        "id": "Hujan ringan",
        "en": "Slight rain",
    }
    assert normalized["forecast"][0]["temperature_c"] == 29


def test_normalizer_rejects_missing_forecast():
    with pytest.raises(WeatherProviderError) as exc:
        normalize_open_meteo_payload({"latitude": -6.1, "longitude": 106.8})
    assert exc.value.category == "invalid_schema"


@pytest.mark.django_db
def test_weather_outside_window_does_not_call_provider():
    invitation = create_invitation(theme=create_theme())
    create_weather_event(
        invitation=invitation,
        starts_at=timezone.now() + timedelta(days=20),
    )

    with patch("weather.services.fetch_open_meteo_forecast") as fetch:
        result = weather_for_invitation(invitation)

    assert result["reason"] == "outside_forecast_window"
    fetch.assert_not_called()


@pytest.mark.django_db
def test_weather_without_coordinates_returns_unconfigured():
    invitation = create_invitation(theme=create_theme())
    event = create_weather_event(
        invitation=invitation,
        starts_at=timezone.now() + timedelta(days=2),
    )
    event.location.latitude = None
    event.location.longitude = None
    event.location.save(update_fields=["latitude", "longitude", "updated_at"])

    result = weather_for_invitation(invitation)

    assert result["reason"] == "location_unconfigured"


@pytest.mark.django_db
@override_settings(OPEN_METEO_CACHE_TTL_SECONDS=3600)
def test_refresh_persists_and_caches_normalized_snapshot():
    cache.clear()
    key = location_key("-6.164721", "106.845384")

    with patch(
        "weather.services.fetch_open_meteo_forecast",
        return_value=open_meteo_payload(),
    ) as fetch:
        first = refresh_forecast(key, latitude="-6.164721", longitude="106.845384")
        second = refresh_forecast(key, latitude="-6.164721", longitude="106.845384")

    assert first == second
    assert fetch.call_count == 1
    assert WeatherSnapshot.objects.filter(provider="Open-Meteo", location_key=key).count() == 1
    assert WeatherFetchLog.objects.filter(provider="Open-Meteo", status="success").count() == 1


@pytest.mark.django_db
def test_weather_endpoint_returns_selected_forecast(client):
    cache.clear()
    event_at = timezone.now() + timedelta(hours=24)
    invitation = create_invitation(theme=create_theme())
    create_weather_event(invitation=invitation, starts_at=event_at)

    with patch(
        "weather.services.fetch_open_meteo_forecast",
        return_value=open_meteo_payload(event_at),
    ):
        response = client.get(
            reverse(
                "invitation-weather",
                kwargs={"public_slug": invitation.public_slug},
            )
        )

    assert response.status_code == 200
    assert response.json()["provider"] == "Open-Meteo"
    assert response.json()["status"] == "ready"
    assert response.json()["selected"]["description"]["en"] == "Slight rain"
    assert response.json()["attribution_url"] == "https://open-meteo.com/"


@pytest.mark.django_db
def test_provider_failure_uses_stale_snapshot():
    cache.clear()
    event_at = timezone.now() + timedelta(hours=24)
    invitation = create_invitation(theme=create_theme())
    event = create_weather_event(invitation=invitation, starts_at=event_at)
    key = location_key(event.location.latitude, event.location.longitude)

    with patch(
        "weather.services.fetch_open_meteo_forecast",
        return_value=open_meteo_payload(event_at),
    ):
        refresh_forecast(
            key,
            latitude=event.location.latitude,
            longitude=event.location.longitude,
        )
    cache.clear()

    with patch(
        "weather.services.fetch_open_meteo_forecast",
        side_effect=WeatherProviderError("timeout", "Timed out"),
    ):
        result = weather_for_invitation(invitation)

    assert result["status"] == "stale"
    assert result["selected"]["temperature_c"] == 29


@pytest.mark.django_db
def test_scheduler_enqueues_distinct_upcoming_locations():
    cache.clear()
    invitation = create_invitation(theme=create_theme())
    event = create_weather_event(
        invitation=invitation,
        starts_at=timezone.now() + timedelta(hours=24),
    )
    key = location_key(event.location.latitude, event.location.longitude)

    with patch("weather.tasks.refresh_location_forecast.apply_async") as enqueue:
        count = schedule_upcoming_weather_refreshes()

    assert count == 1
    enqueue.assert_called_once_with(
        args=[key, str(event.location.latitude), str(event.location.longitude)],
        countdown=0,
    )

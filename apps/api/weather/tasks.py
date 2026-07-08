from __future__ import annotations

from datetime import timedelta

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

from invitations.models import EventLocation, Invitation
from weather.exceptions import WeatherProviderError
from weather.services import location_key, refresh_forecast


@shared_task(
    autoretry_for=(WeatherProviderError,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=3,
    rate_limit="50/m",
)
def refresh_location_forecast(key: str, latitude: str, longitude: str) -> None:
    refresh_forecast(key, force=True, latitude=latitude, longitude=longitude)


@shared_task
def schedule_upcoming_weather_refreshes() -> int:
    lock_key = "weather:scheduler-lock"
    try:
        lock_acquired = cache.add(lock_key, "locked", timeout=300)
    except Exception:
        lock_acquired = True
    if not lock_acquired:
        return 0

    try:
        now = timezone.now()
        locations = (
            EventLocation.objects.filter(
                latitude__isnull=False,
                longitude__isnull=False,
                event__invitation__status=Invitation.Status.PUBLISHED,
                event__starts_at__gte=now,
                event__starts_at__lte=now + timedelta(days=16),
            )
            .values_list("latitude", "longitude")
            .distinct()
        )
        queued: list[tuple[str, str, str]] = []
        for latitude, longitude in locations:
            key = location_key(latitude, longitude)
            if key is None:
                continue
            queued.append((key, str(latitude), str(longitude)))
        for index, (key, latitude, longitude) in enumerate(queued):
            refresh_location_forecast.apply_async(
                args=[key, latitude, longitude],
                countdown=index * 2,
            )
        return len(queued)
    finally:
        try:
            cache.delete(lock_key)
        except Exception:
            pass

from __future__ import annotations

from datetime import timedelta

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

from invitations.models import EventLocation, Invitation
from weather.exceptions import WeatherProviderError
from weather.services import refresh_forecast


@shared_task(
    autoretry_for=(WeatherProviderError,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=3,
    rate_limit="50/m",
)
def refresh_adm4_forecast(adm4: str) -> None:
    refresh_forecast(adm4, force=True)


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
        adm4_codes = (
            EventLocation.objects.filter(
                bmkg_adm4__gt="",
                event__invitation__status=Invitation.Status.PUBLISHED,
                event__starts_at__gte=now,
                event__starts_at__lte=now + timedelta(hours=72),
            )
            .values_list("bmkg_adm4", flat=True)
            .distinct()
        )
        codes = list(adm4_codes)
        for index, adm4 in enumerate(codes):
            refresh_adm4_forecast.apply_async(args=[adm4], countdown=index * 2)
        return len(codes)
    finally:
        try:
            cache.delete(lock_key)
        except Exception:
            pass

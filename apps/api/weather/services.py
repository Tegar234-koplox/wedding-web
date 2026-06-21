from __future__ import annotations

import hashlib
import json
import time
from datetime import timedelta
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from invitations.models import Invitation
from weather.client import fetch_bmkg_forecast
from weather.exceptions import WeatherProviderError
from weather.models import WeatherFetchLog, WeatherSnapshot
from weather.normalizers import normalize_bmkg_payload

PROVIDER_NAME = "BMKG"
PROVIDER_ATTRIBUTION_URL = "https://data.bmkg.go.id/prakiraan-cuaca/"


def _cache_key(adm4: str) -> str:
    return f"weather:forecast:{adm4}"


def _refresh_lock_key(adm4: str) -> str:
    return f"weather:refresh-lock:{adm4}"


def _cache_get(key: str) -> Any:
    try:
        return cache.get(key)
    except Exception:
        return None


def _cache_set(key: str, value: Any, timeout: int) -> None:
    try:
        cache.set(key, value, timeout=timeout)
    except Exception:
        pass


def _acquire_lock(key: str, timeout: int) -> bool:
    try:
        return bool(cache.add(key, "locked", timeout=timeout))
    except Exception:
        return True


def _release_lock(key: str) -> None:
    try:
        cache.delete(key)
    except Exception:
        pass


def _snapshot_payload(snapshot: WeatherSnapshot) -> dict[str, Any]:
    return {
        "location": snapshot.location,
        "analysis_at": snapshot.analysis_at.isoformat(),
        "forecast": snapshot.forecast,
        "fetched_at": snapshot.fetched_at.isoformat(),
        "expires_at": snapshot.expires_at.isoformat(),
    }


def _latest_snapshot(adm4: str) -> WeatherSnapshot | None:
    return WeatherSnapshot.objects.filter(adm4=adm4).order_by("-analysis_at").first()


def refresh_forecast(adm4: str, *, force: bool = False) -> dict[str, Any]:
    cached = _cache_get(_cache_key(adm4))
    if cached is not None and not force:
        return cached

    lock_acquired = _acquire_lock(
        _refresh_lock_key(adm4),
        timeout=max(settings.BMKG_REQUEST_TIMEOUT_SECONDS * 3, 30),
    )
    if not lock_acquired:
        stale = _latest_snapshot(adm4)
        if stale is not None:
            return _snapshot_payload(stale)
        raise WeatherProviderError("refresh_in_progress", "Forecast refresh is in progress.")

    started = time.monotonic()
    try:
        raw = fetch_bmkg_forecast(adm4)
        normalized = normalize_bmkg_payload(raw)
        analysis_at = parse_datetime(normalized["analysis_at"])
        if analysis_at is None:
            raise WeatherProviderError("invalid_schema", "BMKG analysis time is invalid.")

        now = timezone.now()
        expires_at = now + timedelta(seconds=settings.BMKG_CACHE_TTL_SECONDS)
        checksum = hashlib.sha256(
            json.dumps(raw, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()

        with transaction.atomic():
            snapshot, _ = WeatherSnapshot.objects.update_or_create(
                adm4=adm4,
                analysis_at=analysis_at,
                defaults={
                    "location": normalized["location"],
                    "forecast": normalized["forecast"],
                    "raw_checksum": checksum,
                    "fetched_at": now,
                    "expires_at": expires_at,
                },
            )
            WeatherFetchLog.objects.create(
                adm4=adm4,
                status=WeatherFetchLog.Status.SUCCESS,
                latency_ms=int((time.monotonic() - started) * 1000),
                analysis_at=analysis_at,
            )

        payload = _snapshot_payload(snapshot)
        _cache_set(
            _cache_key(adm4),
            payload,
            timeout=settings.BMKG_CACHE_TTL_SECONDS,
        )
        return payload
    except WeatherProviderError as exc:
        WeatherFetchLog.objects.create(
            adm4=adm4,
            status=WeatherFetchLog.Status.FAILURE,
            latency_ms=int((time.monotonic() - started) * 1000),
            failure_category=exc.category,
        )
        raise
    finally:
        _release_lock(_refresh_lock_key(adm4))


def _unavailable(reason: str) -> dict[str, Any]:
    return {
        "status": "unavailable",
        "reason": reason,
        "provider": PROVIDER_NAME,
        "attribution_url": PROVIDER_ATTRIBUTION_URL,
        "forecast": [],
    }


def weather_for_invitation(invitation: Invitation) -> dict[str, Any]:
    now = timezone.now()
    weather_events = invitation.events.filter(
        location__bmkg_adm4__gt="",
    ).select_related("location")
    if not weather_events.exists():
        return _unavailable("location_unconfigured")

    event = (
        weather_events.filter(starts_at__gte=now - timedelta(hours=6)).order_by("starts_at").first()
    )
    if event is None:
        return _unavailable("event_passed")
    if event.starts_at > now + timedelta(hours=72):
        return _unavailable("outside_forecast_window")

    adm4 = event.location.bmkg_adm4
    stale = False
    try:
        snapshot = refresh_forecast(adm4)
    except WeatherProviderError:
        stored = _latest_snapshot(adm4)
        if stored is None:
            return _unavailable("provider_unavailable")
        snapshot = _snapshot_payload(stored)
        stale = True

    try:
        event_timezone = ZoneInfo(event.timezone)
    except ZoneInfoNotFoundError:
        event_timezone = ZoneInfo("Asia/Jakarta")

    event_local = event.starts_at.astimezone(event_timezone)
    event_date = event_local.date().isoformat()
    day_forecast = [
        item
        for item in snapshot["forecast"]
        if str(item.get("local_at", "")).startswith(event_date)
    ]
    if not day_forecast:
        return _unavailable("forecast_not_yet_available")

    event_timestamp = event.starts_at.timestamp()
    selected = min(
        day_forecast,
        key=lambda item: abs(
            (parse_datetime(item["at"]) or event.starts_at).timestamp() - event_timestamp
        ),
    )

    return {
        "status": "stale" if stale else "ready",
        "reason": None,
        "provider": PROVIDER_NAME,
        "attribution_url": PROVIDER_ATTRIBUTION_URL,
        "updated_at": snapshot["analysis_at"],
        "location": snapshot["location"],
        "event": {
            "starts_at": event.starts_at.isoformat(),
            "timezone": event.timezone,
            "venue": event.venue_name,
        },
        "selected": selected,
        "forecast": day_forecast,
    }

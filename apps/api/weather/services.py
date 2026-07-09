from __future__ import annotations

import hashlib
import json
import time
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from invitations.models import Invitation, WeddingEvent
from weather.client import fetch_open_meteo_forecast
from weather.exceptions import WeatherProviderError
from weather.models import WeatherFetchLog, WeatherSnapshot
from weather.normalizers import normalize_open_meteo_payload

PROVIDER_NAME = "Open-Meteo"
PROVIDER_ATTRIBUTION_URL = "https://open-meteo.com/"


def _coordinate(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value)).quantize(Decimal("0.000001"))
    except (InvalidOperation, ValueError):
        return None


def location_key(latitude: Any, longitude: Any) -> str | None:
    lat = _coordinate(latitude)
    lon = _coordinate(longitude)
    if lat is None or lon is None:
        return None
    return f"open-meteo:{lat}:{lon}"


def _legacy_adm4_from_key(key: str) -> str:
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:20]


def _cache_key(key: str) -> str:
    return f"weather:forecast:{key}"


def _refresh_lock_key(key: str) -> str:
    return f"weather:refresh-lock:{key}"


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


def _latest_snapshot(key: str) -> WeatherSnapshot | None:
    return (
        WeatherSnapshot.objects.filter(provider=PROVIDER_NAME, location_key=key)
        .order_by("-analysis_at", "-fetched_at")
        .first()
    )


def refresh_forecast(
    location: str | None = None,
    *,
    force: bool = False,
    latitude: Any = None,
    longitude: Any = None,
) -> dict[str, Any]:
    key = location or location_key(latitude, longitude)
    if key is None:
        raise WeatherProviderError("location_unconfigured", "Weather coordinates are missing.")

    cached = _cache_get(_cache_key(key))
    if cached is not None and not force:
        return cached

    lock_acquired = _acquire_lock(
        _refresh_lock_key(key),
        timeout=max(settings.OPEN_METEO_REQUEST_TIMEOUT_SECONDS * 3, 30),
    )
    if not lock_acquired:
        stale = _latest_snapshot(key)
        if stale is not None:
            return _snapshot_payload(stale)
        raise WeatherProviderError("refresh_in_progress", "Forecast refresh is in progress.")

    if latitude is None or longitude is None:
        try:
            _, lat_text, lon_text = key.split(":", 2)
        except ValueError as exc:
            raise WeatherProviderError(
                "invalid_coordinate",
                "Weather location key is invalid.",
            ) from exc
        latitude = lat_text
        longitude = lon_text

    started = time.monotonic()
    try:
        raw = fetch_open_meteo_forecast(latitude, longitude)
        normalized = normalize_open_meteo_payload(raw)
        analysis_at = parse_datetime(normalized["analysis_at"])
        if analysis_at is None:
            raise WeatherProviderError("invalid_schema", "Open-Meteo analysis time is invalid.")

        now = timezone.now()
        expires_at = now + timedelta(seconds=settings.OPEN_METEO_CACHE_TTL_SECONDS)
        checksum = hashlib.sha256(
            json.dumps(raw, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        legacy_adm4 = _legacy_adm4_from_key(key)

        with transaction.atomic():
            snapshot, _ = WeatherSnapshot.objects.update_or_create(
                provider=PROVIDER_NAME,
                location_key=key,
                analysis_at=analysis_at,
                defaults={
                    "adm4": legacy_adm4,
                    "location": normalized["location"],
                    "forecast": normalized["forecast"],
                    "raw_checksum": checksum,
                    "fetched_at": now,
                    "expires_at": expires_at,
                },
            )
            WeatherFetchLog.objects.create(
                adm4=legacy_adm4,
                provider=PROVIDER_NAME,
                location_key=key,
                status=WeatherFetchLog.Status.SUCCESS,
                latency_ms=int((time.monotonic() - started) * 1000),
                analysis_at=analysis_at,
            )

        payload = _snapshot_payload(snapshot)
        _cache_set(
            _cache_key(key),
            payload,
            timeout=settings.OPEN_METEO_CACHE_TTL_SECONDS,
        )
        return payload
    except WeatherProviderError as exc:
        WeatherFetchLog.objects.create(
            adm4=_legacy_adm4_from_key(key),
            provider=PROVIDER_NAME,
            location_key=key,
            status=WeatherFetchLog.Status.FAILURE,
            latency_ms=int((time.monotonic() - started) * 1000),
            failure_category=exc.category,
        )
        raise
    finally:
        _release_lock(_refresh_lock_key(key))


def _unavailable(reason: str) -> dict[str, Any]:
    return {
        "status": "unavailable",
        "reason": reason,
        "provider": PROVIDER_NAME,
        "attribution_url": PROVIDER_ATTRIBUTION_URL,
        "forecast": [],
    }


def _event_timezone(event: WeddingEvent, snapshot: dict[str, Any]) -> ZoneInfo:
    try:
        return ZoneInfo(event.timezone)
    except ZoneInfoNotFoundError:
        try:
            return ZoneInfo(snapshot["location"].get("timezone") or "UTC")
        except ZoneInfoNotFoundError:
            return ZoneInfo("UTC")


def _event_payload(event: WeddingEvent) -> dict[str, Any]:
    return {
        "event_type": event.event_type,
        "starts_at": event.starts_at.isoformat(),
        "timezone": event.timezone,
        "venue": event.venue_name,
    }


def _location_payload(event: WeddingEvent, snapshot: dict[str, Any]) -> dict[str, Any]:
    return {
        **snapshot["location"],
        "venue": event.venue_name,
        "address": event.address,
    }


def _selected_forecast_for_event(
    event: WeddingEvent,
    snapshot: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    event_timezone = _event_timezone(event, snapshot)
    event_local = event.starts_at.astimezone(event_timezone)
    event_date = event_local.date().isoformat()
    day_forecast = [
        item
        for item in snapshot["forecast"]
        if str(item.get("local_at", "")).startswith(event_date)
    ]
    if not day_forecast:
        return [], None

    event_timestamp = event.starts_at.timestamp()
    selected = min(
        day_forecast,
        key=lambda item: abs(
            (parse_datetime(item["at"]) or event.starts_at).timestamp() - event_timestamp
        ),
    )
    return day_forecast, selected


def weather_for_invitation(invitation: Invitation) -> dict[str, Any]:
    now = timezone.now()
    weather_events = invitation.events.filter(
        location__latitude__isnull=False,
        location__longitude__isnull=False,
        event_type__in=[
            WeddingEvent.EventType.CEREMONY,
            WeddingEvent.EventType.RECEPTION,
        ],
    ).select_related("location")
    if not weather_events.exists():
        return _unavailable("location_unconfigured")

    events = list(
        weather_events.filter(starts_at__gte=now - timedelta(hours=6)).order_by(
            "starts_at",
            "sort_order",
        )
    )
    if not events:
        return _unavailable("event_passed")

    selections = []
    has_stale = False
    unavailable_reason = "forecast_not_yet_available"
    for event in events:
        if event.starts_at > now + timedelta(days=16):
            unavailable_reason = "outside_forecast_window"
            continue

        key = location_key(event.location.latitude, event.location.longitude)
        if key is None:
            unavailable_reason = "location_unconfigured"
            continue

        stale = False
        try:
            snapshot = refresh_forecast(
                key,
                latitude=event.location.latitude,
                longitude=event.location.longitude,
            )
        except WeatherProviderError:
            stored = _latest_snapshot(key)
            if stored is None:
                unavailable_reason = "provider_unavailable"
                continue
            snapshot = _snapshot_payload(stored)
            stale = True

        day_forecast, selected = _selected_forecast_for_event(event, snapshot)
        if selected is None:
            unavailable_reason = "forecast_not_yet_available"
            continue

        has_stale = has_stale or stale
        selections.append(
            {
                "event": _event_payload(event),
                "location": _location_payload(event, snapshot),
                "selected": selected,
                "forecast": day_forecast,
            }
        )

    if not selections:
        return _unavailable(unavailable_reason)

    primary = selections[0]

    return {
        "status": "stale" if has_stale else "ready",
        "reason": None,
        "provider": PROVIDER_NAME,
        "attribution_url": PROVIDER_ATTRIBUTION_URL,
        "updated_at": max(item["selected"]["analysis_at"] for item in selections),
        "location": primary["location"],
        "event": primary["event"],
        "selected": primary["selected"],
        "forecast": primary["forecast"],
        "selections": selections,
    }

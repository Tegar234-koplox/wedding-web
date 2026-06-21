from __future__ import annotations

from datetime import UTC
from typing import Any

from django.utils.dateparse import parse_datetime

from weather.exceptions import WeatherProviderError


def _number(value: Any, field: str) -> int | float:
    if not isinstance(value, (int, float)):
        raise WeatherProviderError("invalid_schema", f"BMKG field {field} must be numeric.")
    return value


def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise WeatherProviderError("invalid_schema", f"BMKG field {field} must be text.")
    return value.strip()


def _iso_datetime(value: Any, field: str) -> str:
    parsed = parse_datetime(_text(value, field))
    if parsed is None:
        raise WeatherProviderError("invalid_schema", f"BMKG field {field} is invalid.")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.isoformat()


def normalize_bmkg_payload(payload: dict[str, Any]) -> dict[str, Any]:
    location = payload.get("lokasi")
    data = payload.get("data")
    if not isinstance(location, dict) or not isinstance(data, list) or not data:
        raise WeatherProviderError("invalid_schema", "BMKG location or forecast is missing.")

    normalized_location = {
        "adm4": _text(location.get("adm4"), "lokasi.adm4"),
        "province": _text(location.get("provinsi"), "lokasi.provinsi"),
        "regency": _text(location.get("kotkab"), "lokasi.kotkab"),
        "district": _text(location.get("kecamatan"), "lokasi.kecamatan"),
        "village": _text(location.get("desa"), "lokasi.desa"),
        "latitude": _number(location.get("lat"), "lokasi.lat"),
        "longitude": _number(location.get("lon"), "lokasi.lon"),
        "timezone": _text(location.get("timezone"), "lokasi.timezone"),
    }

    first_data = data[0]
    if not isinstance(first_data, dict) or not isinstance(first_data.get("cuaca"), list):
        raise WeatherProviderError("invalid_schema", "BMKG forecast groups are missing.")

    entries: list[dict[str, Any]] = []
    for group in first_data["cuaca"]:
        if not isinstance(group, list):
            continue
        for item in group:
            if not isinstance(item, dict):
                continue
            entries.append(
                {
                    "at": _iso_datetime(item.get("datetime"), "datetime"),
                    "local_at": _text(item.get("local_datetime"), "local_datetime"),
                    "analysis_at": _iso_datetime(
                        item.get("analysis_date"),
                        "analysis_date",
                    ),
                    "temperature_c": _number(item.get("t"), "t"),
                    "humidity_percent": _number(item.get("hu"), "hu"),
                    "cloud_cover_percent": _number(item.get("tcc"), "tcc"),
                    "precipitation_mm": _number(item.get("tp"), "tp"),
                    "weather_code": _number(item.get("weather"), "weather"),
                    "description": {
                        "id": _text(item.get("weather_desc"), "weather_desc"),
                        "en": _text(item.get("weather_desc_en"), "weather_desc_en"),
                    },
                    "wind": {
                        "speed_kmh": _number(item.get("ws"), "ws"),
                        "from": _text(item.get("wd"), "wd"),
                        "to": _text(item.get("wd_to"), "wd_to"),
                        "degrees": _number(item.get("wd_deg"), "wd_deg"),
                    },
                    "visibility_m": _number(item.get("vs"), "vs"),
                    "visibility_text": _text(item.get("vs_text"), "vs_text"),
                }
            )

    if not entries:
        raise WeatherProviderError("empty_forecast", "BMKG returned no forecast entries.")

    entries.sort(key=lambda item: item["at"])
    analysis_at = max(item["analysis_at"] for item in entries)
    return {
        "location": normalized_location,
        "analysis_at": analysis_at,
        "forecast": entries,
    }

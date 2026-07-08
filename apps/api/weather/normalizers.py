from __future__ import annotations

from datetime import UTC
from typing import Any

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from weather.exceptions import WeatherProviderError

WMO_DESCRIPTIONS: dict[int, dict[str, str]] = {
    0: {"id": "Cerah", "en": "Clear sky"},
    1: {"id": "Sebagian cerah", "en": "Mainly clear"},
    2: {"id": "Berawan sebagian", "en": "Partly cloudy"},
    3: {"id": "Berawan", "en": "Overcast"},
    45: {"id": "Berkabut", "en": "Fog"},
    48: {"id": "Kabut beku", "en": "Depositing rime fog"},
    51: {"id": "Gerimis ringan", "en": "Light drizzle"},
    53: {"id": "Gerimis sedang", "en": "Moderate drizzle"},
    55: {"id": "Gerimis lebat", "en": "Dense drizzle"},
    56: {"id": "Gerimis beku ringan", "en": "Light freezing drizzle"},
    57: {"id": "Gerimis beku lebat", "en": "Dense freezing drizzle"},
    61: {"id": "Hujan ringan", "en": "Slight rain"},
    63: {"id": "Hujan sedang", "en": "Moderate rain"},
    65: {"id": "Hujan lebat", "en": "Heavy rain"},
    66: {"id": "Hujan beku ringan", "en": "Light freezing rain"},
    67: {"id": "Hujan beku lebat", "en": "Heavy freezing rain"},
    71: {"id": "Salju ringan", "en": "Slight snow fall"},
    73: {"id": "Salju sedang", "en": "Moderate snow fall"},
    75: {"id": "Salju lebat", "en": "Heavy snow fall"},
    77: {"id": "Butiran salju", "en": "Snow grains"},
    80: {"id": "Hujan lokal ringan", "en": "Slight rain showers"},
    81: {"id": "Hujan lokal sedang", "en": "Moderate rain showers"},
    82: {"id": "Hujan lokal kuat", "en": "Violent rain showers"},
    85: {"id": "Hujan salju ringan", "en": "Slight snow showers"},
    86: {"id": "Hujan salju lebat", "en": "Heavy snow showers"},
    95: {"id": "Badai petir", "en": "Thunderstorm"},
    96: {"id": "Badai petir dengan hujan es ringan", "en": "Thunderstorm with slight hail"},
    99: {"id": "Badai petir dengan hujan es lebat", "en": "Thunderstorm with heavy hail"},
}


def _number(value: Any, field: str) -> int | float:
    if not isinstance(value, (int, float)):
        raise WeatherProviderError("invalid_schema", f"Open-Meteo field {field} must be numeric.")
    return value


def _optional_number(value: Any, field: str, default: int | float = 0) -> int | float:
    if value is None:
        return default
    return _number(value, field)


def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise WeatherProviderError("invalid_schema", f"Open-Meteo field {field} must be text.")
    return value.strip()


def _local_datetime(value: Any, utc_offset_seconds: int) -> tuple[str, str]:
    raw = _text(value, "hourly.time")
    parsed = parse_datetime(raw)
    if parsed is None:
        raise WeatherProviderError("invalid_schema", "Open-Meteo hourly time is invalid.")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.get_fixed_timezone(utc_offset_seconds // 60))
    local_at = raw.replace("T", " ")
    if len(local_at) == 16:
        local_at = f"{local_at}:00"
    return parsed.astimezone(UTC).isoformat(), local_at


def _series(hourly: dict[str, Any], field: str) -> list[Any]:
    value = hourly.get(field)
    if not isinstance(value, list):
        raise WeatherProviderError("invalid_schema", f"Open-Meteo hourly field {field} is missing.")
    return value


def _wind_compass(degrees: int | float) -> str:
    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    index = round((float(degrees) % 360) / 45) % 8
    return directions[index]


def normalize_open_meteo_payload(payload: dict[str, Any]) -> dict[str, Any]:
    hourly = payload.get("hourly")
    if not isinstance(hourly, dict):
        raise WeatherProviderError("invalid_schema", "Open-Meteo hourly forecast is missing.")

    times = _series(hourly, "time")
    timezone_name = _text(payload.get("timezone") or "UTC", "timezone")
    utc_offset_seconds = int(
        _optional_number(payload.get("utc_offset_seconds"), "utc_offset_seconds")
    )
    latitude = _number(payload.get("latitude"), "latitude")
    longitude = _number(payload.get("longitude"), "longitude")

    normalized_location = {
        "provider": "Open-Meteo",
        "latitude": latitude,
        "longitude": longitude,
        "timezone": timezone_name,
        "village": "Event location",
        "regency": "",
    }

    temperature = _series(hourly, "temperature_2m")
    humidity = _series(hourly, "relative_humidity_2m")
    cloud_cover = _series(hourly, "cloud_cover")
    precipitation = _series(hourly, "precipitation")
    weather_code = _series(hourly, "weather_code")
    wind_speed = _series(hourly, "wind_speed_10m")
    wind_direction = _series(hourly, "wind_direction_10m")
    visibility = _series(hourly, "visibility")
    series = [
        temperature,
        humidity,
        cloud_cover,
        precipitation,
        weather_code,
        wind_speed,
        wind_direction,
        visibility,
    ]
    if any(len(items) < len(times) for items in series):
        raise WeatherProviderError("invalid_schema", "Open-Meteo hourly series length is invalid.")

    entries: list[dict[str, Any]] = []
    for index, raw_time in enumerate(times):
        code = int(_optional_number(weather_code[index], f"weather_code.{index}"))
        at, local_at = _local_datetime(raw_time, utc_offset_seconds)
        degrees = _optional_number(wind_direction[index], f"wind_direction_10m.{index}")
        direction = _wind_compass(degrees)
        entries.append(
            {
                "at": at,
                "local_at": local_at,
                "analysis_at": timezone.now().isoformat(),
                "temperature_c": _optional_number(temperature[index], f"temperature_2m.{index}"),
                "humidity_percent": _optional_number(
                    humidity[index],
                    f"relative_humidity_2m.{index}",
                ),
                "cloud_cover_percent": _optional_number(
                    cloud_cover[index],
                    f"cloud_cover.{index}",
                ),
                "precipitation_mm": _optional_number(
                    precipitation[index],
                    f"precipitation.{index}",
                ),
                "weather_code": code,
                "description": WMO_DESCRIPTIONS.get(
                    code,
                    {"id": "Cuaca berubah", "en": "Variable conditions"},
                ),
                "wind": {
                    "speed_kmh": _optional_number(wind_speed[index], f"wind_speed_10m.{index}"),
                    "from": direction,
                    "to": direction,
                    "degrees": degrees,
                },
                "visibility_m": _optional_number(visibility[index], f"visibility.{index}"),
                "visibility_text": "",
            }
        )

    if not entries:
        raise WeatherProviderError("empty_forecast", "Open-Meteo returned no forecast entries.")

    entries.sort(key=lambda item: item["at"])
    return {
        "location": normalized_location,
        "analysis_at": timezone.now().isoformat(),
        "forecast": entries,
    }

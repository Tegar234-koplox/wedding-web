from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal, InvalidOperation
from typing import Any

from django.conf import settings

from weather.exceptions import WeatherProviderError

OPEN_METEO_HOURLY_FIELDS = (
    "temperature_2m",
    "relative_humidity_2m",
    "cloud_cover",
    "precipitation",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
    "visibility",
)


def _coordinate(value: Decimal | float | str, *, minimum: Decimal, maximum: Decimal) -> Decimal:
    try:
        coordinate = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise WeatherProviderError("invalid_coordinate", "Weather coordinate is invalid.") from exc
    if coordinate < minimum or coordinate > maximum:
        raise WeatherProviderError("invalid_coordinate", "Weather coordinate is out of range.")
    return coordinate.quantize(Decimal("0.000001"))


def fetch_open_meteo_forecast(
    latitude: Decimal | float | str,
    longitude: Decimal | float | str,
) -> dict[str, Any]:
    lat = _coordinate(latitude, minimum=Decimal("-90"), maximum=Decimal("90"))
    lon = _coordinate(longitude, minimum=Decimal("-180"), maximum=Decimal("180"))

    base_url = settings.OPEN_METEO_API_BASE_URL.rstrip("/")
    if not base_url.startswith("https://"):
        raise WeatherProviderError("configuration", "Open-Meteo endpoint must use HTTPS.")

    query = urllib.parse.urlencode(
        {
            "latitude": str(lat),
            "longitude": str(lon),
            "hourly": ",".join(OPEN_METEO_HOURLY_FIELDS),
            "forecast_days": 16,
            "timezone": "auto",
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
        }
    )
    request = urllib.request.Request(
        f"{base_url}/v1/forecast?{query}",
        headers={
            "Accept": "application/json",
            "User-Agent": "NiskalaWedding/1.0 (+https://niskala.example)",
        },
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=settings.OPEN_METEO_REQUEST_TIMEOUT_SECONDS,
        ) as response:
            if response.status != 200:
                raise WeatherProviderError(
                    "http_error",
                    f"Open-Meteo returned status {response.status}.",
                )
            payload = json.loads(response.read())
    except urllib.error.HTTPError as exc:
        category = "rate_limited" if exc.code == 429 else "http_error"
        raise WeatherProviderError(category, "Open-Meteo request failed.") from exc
    except urllib.error.URLError as exc:
        category = "timeout" if isinstance(exc.reason, TimeoutError) else "network"
        raise WeatherProviderError(category, "Open-Meteo could not be reached.") from exc
    except (TimeoutError, json.JSONDecodeError) as exc:
        category = "timeout" if isinstance(exc, TimeoutError) else "invalid_json"
        raise WeatherProviderError(category, "Open-Meteo response could not be read.") from exc

    if not isinstance(payload, dict):
        raise WeatherProviderError("invalid_schema", "Open-Meteo response must be an object.")
    return payload

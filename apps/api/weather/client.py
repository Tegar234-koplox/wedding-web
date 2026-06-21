from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from django.conf import settings

from weather.exceptions import WeatherProviderError

ADM4_PATTERN = re.compile(r"^\d{2}\.\d{2}\.\d{2}\.\d{4}$")


def fetch_bmkg_forecast(adm4: str) -> dict[str, Any]:
    if not ADM4_PATTERN.fullmatch(adm4):
        raise WeatherProviderError("invalid_adm4", "Invalid BMKG administrative code.")

    base_url = settings.BMKG_API_BASE_URL.rstrip("/")
    if not base_url.startswith("https://"):
        raise WeatherProviderError("configuration", "BMKG endpoint must use HTTPS.")

    query = urllib.parse.urlencode({"adm4": adm4})
    request = urllib.request.Request(
        f"{base_url}/publik/prakiraan-cuaca?{query}",
        headers={
            "Accept": "application/json",
            "User-Agent": "NiskalaWedding/1.0 (+https://niskala.example)",
        },
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=settings.BMKG_REQUEST_TIMEOUT_SECONDS,
        ) as response:
            if response.status != 200:
                raise WeatherProviderError(
                    "http_error",
                    f"BMKG returned status {response.status}.",
                )
            payload = json.loads(response.read())
    except urllib.error.HTTPError as exc:
        category = "rate_limited" if exc.code == 429 else "http_error"
        raise WeatherProviderError(category, "BMKG request failed.") from exc
    except urllib.error.URLError as exc:
        category = "timeout" if isinstance(exc.reason, TimeoutError) else "network"
        raise WeatherProviderError(category, "BMKG could not be reached.") from exc
    except (TimeoutError, json.JSONDecodeError) as exc:
        category = "timeout" if isinstance(exc, TimeoutError) else "invalid_json"
        raise WeatherProviderError(category, "BMKG response could not be read.") from exc

    if not isinstance(payload, dict):
        raise WeatherProviderError("invalid_schema", "BMKG response must be an object.")
    return payload

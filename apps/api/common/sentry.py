from __future__ import annotations

import re
from typing import Any

SENSITIVE_QUERY_VALUE = re.compile(
    r"([?&](?:preview|guest|access|token)=)[^&#\s]*",
    re.IGNORECASE,
)
GRANT_FRAGMENT = re.compile(r"#grant=[^&\s]*", re.IGNORECASE)
LEGACY_PATH_TOKEN = re.compile(
    r"(/(?:guest-management|guest-delivery|client/access)/)[^/?#\s]+",
    re.IGNORECASE,
)
URL_KEYS = {"url", "href", "from", "to"}
SENSITIVE_KEYS = {
    "authorization",
    "access",
    "challenge",
    "code",
    "cookie",
    "csrf_token",
    "current_pin",
    "grant",
    "guest",
    "initial_pin",
    "next_pin",
    "otpauth_uri",
    "password",
    "pin",
    "preview",
    "qr_data_url",
    "recovery_code",
    "recovery_codes",
    "set_cookie",
    "signature",
    "token",
}


def _is_sensitive_key(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    return (
        normalized in SENSITIVE_KEYS
        or normalized.endswith("_pin")
        or normalized.endswith("_token")
        or normalized.endswith("_secret")
    )


def redact_sensitive_text(value: str) -> str:
    redacted = SENSITIVE_QUERY_VALUE.sub(r"\1[Filtered]", value)
    redacted = GRANT_FRAGMENT.sub("#grant=[Filtered]", redacted)
    return LEGACY_PATH_TOKEN.sub(r"\1[Filtered]", redacted)


def strip_url_secrets(value: str) -> str:
    redacted = redact_sensitive_text(value)
    indexes = [index for index in (redacted.find("?"), redacted.find("#")) if index >= 0]
    return redacted[: min(indexes)] if indexes else redacted


def _scrub(value: Any, *, key: str = "") -> Any:
    if isinstance(value, str):
        return strip_url_secrets(value) if key.lower() in URL_KEYS else redact_sensitive_text(value)
    if isinstance(value, list):
        for index, item in enumerate(value):
            value[index] = _scrub(item, key=key)
        return value
    if isinstance(value, dict):
        for child_key in list(value):
            if _is_sensitive_key(str(child_key)):
                value[child_key] = "[Filtered]"
                continue
            if str(child_key).lower() == "query_string":
                value.pop(child_key, None)
                continue
            value[child_key] = _scrub(value[child_key], key=str(child_key))
    return value


def scrub_sentry_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return _scrub(payload)


def before_send(event: dict[str, Any], _hint: dict[str, Any]) -> dict[str, Any]:
    return scrub_sentry_payload(event)


def before_breadcrumb(
    breadcrumb: dict[str, Any],
    _hint: dict[str, Any],
) -> dict[str, Any]:
    return scrub_sentry_payload(breadcrumb)

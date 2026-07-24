from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from django.core.exceptions import ValidationError

SUPPORTED_RENDERERS = {
    "elegant-classic",
    "islamic-soft",
    "luxury-gold",
    "minimalist-white",
    "dark-cinematic",
    "floral-romantic",
    "javanese-traditional",
}

SUPPORTED_LOCALES = {"id", "en"}


def validate_renderer_key(value: str) -> None:
    if value not in SUPPORTED_RENDERERS:
        raise ValidationError("Unsupported invitation renderer.")


def validate_invitation_content(value: Any) -> None:
    if not isinstance(value, dict):
        raise ValidationError("Invitation content must be an object.")

    required_sections = {
        "couple",
        "opening",
        "event",
        "story",
        "quote",
        "gallery",
        "closing",
    }
    missing = required_sections.difference(value)
    if missing:
        raise ValidationError(f"Missing invitation sections: {', '.join(sorted(missing))}.")

    couple = value.get("couple")
    if isinstance(couple, dict):
        for field in ["partnerOneDescription", "partnerTwoDescription"]:
            description = couple.get(field)
            if description is not None and (
                not isinstance(description, str) or len(description.strip()) > 300
            ):
                raise ValidationError(
                    f"Invitation {field} must be text with at most 300 characters."
                )

    gallery = value.get("gallery")
    if not isinstance(gallery, list) or not 3 <= len(gallery) <= 18:
        raise ValidationError("Invitation gallery must contain between 3 and 18 items.")

    for item in gallery:
        if not isinstance(item, dict):
            raise ValidationError("Each gallery item must be an object.")
        src = item.get("src")
        alt = item.get("alt")
        if not isinstance(src, str):
            raise ValidationError("Gallery sources must be root-relative or HTTP(S) paths.")
        parsed = urlparse(src)
        if not src.startswith("/") and parsed.scheme not in {"http", "https"}:
            raise ValidationError("Gallery sources must be root-relative or HTTP(S) paths.")
        if not isinstance(alt, str) or not alt.strip():
            raise ValidationError("Gallery items require alt text.")

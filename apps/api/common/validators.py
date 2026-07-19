from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError

SUPPORTED_RENDERERS = {
    "elegant-classic",
    "islamic-soft",
    "luxury-gold",
    "minimalist-white",
    "dark-cinematic",
    "floral-romantic",
    "javanese-traditional",
    "bespoke",
}

SUPPORTED_LOCALES = {"id", "en"}

BESPOKE_VARIANTS = {
    "cover": {
        "cover.editorial-split@1",
        "cover.cinematic-center@1",
        "cover.minimal-frame@1",
    },
    "event": {"event.editorial-cards@1", "event.timeline-band@1"},
    "story": {"story.chapters@1", "story.manifesto@1"},
    "timeline": {"timeline.vertical@1", "timeline.horizontal@1"},
    "gallery": {"gallery.asymmetric-grid@1", "gallery.film-strip@1"},
    "quote": {"quote.statement@1"},
    "rsvp": {"rsvp.minimal@1"},
    "gift": {"gift.cards@1"},
    "weather": {"weather.editorial@1"},
    "closing": {"closing.signature@1"},
}

BESPOKE_FONTS = {
    "cormorant-garamond",
    "playfair-display",
    "bodoni-moda",
    "lora",
    "inter",
    "manrope",
}


def validate_bespoke_config(value: Any) -> None:
    if not isinstance(value, dict):
        raise ValidationError("Bespoke configuration must be an object.")
    if value.get("engineVersion") != 1:
        raise ValidationError("Unsupported Bespoke engine version.")
    design_version = value.get("designVersion")
    if not isinstance(design_version, str) or not design_version.strip():
        raise ValidationError("Bespoke design version is required.")

    tokens = value.get("tokens")
    if not isinstance(tokens, dict):
        raise ValidationError("Bespoke design tokens are required.")
    for color_key in ["background", "surface", "text", "muted", "accent", "border"]:
        color = tokens.get(color_key)
        if (
            not isinstance(color, str)
            or len(color) != 7
            or not color.startswith("#")
            or any(character not in "0123456789abcdefABCDEF" for character in color[1:])
        ):
            raise ValidationError(f"Bespoke token {color_key} must be a hex color.")
    for font_key in ["displayFont", "bodyFont"]:
        if tokens.get(font_key) not in BESPOKE_FONTS:
            raise ValidationError(f"Unsupported Bespoke font: {tokens.get(font_key)}.")
    if tokens.get("spacing") not in {"compact", "balanced", "editorial"}:
        raise ValidationError("Unsupported Bespoke spacing token.")
    if tokens.get("radius") not in {"none", "soft", "rounded"}:
        raise ValidationError("Unsupported Bespoke radius token.")

    motion = value.get("motion")
    if not isinstance(motion, dict) or motion.get("reducedMotionFallback") is not True:
        raise ValidationError("Bespoke motion must include a reduced-motion fallback.")
    if motion.get("preset") not in {"none", "soft-reveal", "editorial", "cinematic"}:
        raise ValidationError("Unsupported Bespoke motion preset.")
    if motion.get("intensity") not in {"subtle", "balanced", "expressive"}:
        raise ValidationError("Unsupported Bespoke motion intensity.")
    if motion.get("parallax") not in {"none", "subtle", "premium"}:
        raise ValidationError("Unsupported Bespoke parallax setting.")

    sections = value.get("sections")
    if not isinstance(sections, list) or not 3 <= len(sections) <= 20:
        raise ValidationError("Bespoke configuration must contain between 3 and 20 sections.")
    ids: set[str] = set()
    enabled_types: set[str] = set()
    for section in sections:
        if not isinstance(section, dict):
            raise ValidationError("Each Bespoke section must be an object.")
        section_id = section.get("id")
        section_type = section.get("type")
        variant = section.get("variant")
        if not isinstance(section_id, str) or not section_id.strip() or section_id in ids:
            raise ValidationError("Bespoke section ids must be present and unique.")
        ids.add(section_id)
        if section_type not in BESPOKE_VARIANTS:
            raise ValidationError(f"Unsupported Bespoke section type: {section_type}.")
        if variant not in BESPOKE_VARIANTS[section_type]:
            raise ValidationError(f"Unsupported Bespoke variant: {variant}.")
        if section.get("enabled", True):
            enabled_types.add(section_type)
    missing = {"cover", "event", "closing"}.difference(enabled_types)
    if missing:
        raise ValidationError(f"Missing required Bespoke sections: {', '.join(sorted(missing))}.")


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

    gallery = value.get("gallery")
    if not isinstance(gallery, list) or not 3 <= len(gallery) <= 12:
        raise ValidationError("Invitation gallery must contain between 3 and 12 items.")

    for item in gallery:
        if not isinstance(item, dict):
            raise ValidationError("Each gallery item must be an object.")
        src = item.get("src")
        alt = item.get("alt")
        if not isinstance(src, str) or not src.startswith("/"):
            raise ValidationError("Gallery sources must be root-relative paths.")
        if not isinstance(alt, str) or not alt.strip():
            raise ValidationError("Gallery items require alt text.")

    if "bespoke" in value:
        validate_bespoke_config(value["bespoke"])

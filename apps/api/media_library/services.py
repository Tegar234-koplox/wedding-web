from __future__ import annotations

import time
from typing import Any
from urllib.parse import urlparse

import cloudinary.utils
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, ValidationError

ALLOWED_UPLOAD_FOLDERS = {
    "themes": "wedding/themes",
    "samples": "wedding/samples",
    "invitations": "wedding/invitations",
}
ALLOWED_AUDIO_FORMATS = {"aac", "m4a", "mp3", "ogg", "wav"}
DEFAULT_AUDIO_VOLUME = 0.35


def public_audio_payload(asset: object | None) -> dict[str, Any] | None:
    if asset is None:
        return None

    resource_type = getattr(asset, "resource_type", "")
    format_name = str(getattr(asset, "format", "")).lower()
    secure_url = str(getattr(asset, "secure_url", ""))
    archived_at = getattr(asset, "archived_at", None)
    hostname = (urlparse(secure_url).hostname or "").lower()

    if (
        archived_at is not None
        or resource_type not in {"video", "raw"}
        or format_name not in ALLOWED_AUDIO_FORMATS
        or hostname != "res.cloudinary.com"
        or not secure_url.startswith("https://")
    ):
        return None

    title = str(getattr(asset, "original_filename", "")).strip() or "Background music"
    return {
        "secure_url": secure_url,
        "title": title[:120],
        "loop": True,
        "default_volume": DEFAULT_AUDIO_VOLUME,
    }


def create_upload_signature(
    *,
    namespace: str,
    resource_type: str = "image",
) -> dict[str, Any]:
    folder = ALLOWED_UPLOAD_FOLDERS.get(namespace)
    if folder is None:
        raise ValidationError("Unsupported upload namespace.")
    if resource_type not in {"image", "video"}:
        raise ValidationError("Unsupported upload resource type.")
    if not all(
        [
            settings.CLOUDINARY_CLOUD_NAME,
            settings.CLOUDINARY_API_KEY,
            settings.CLOUDINARY_API_SECRET,
        ]
    ):
        raise ImproperlyConfigured("Cloudinary is not configured.")

    timestamp = int(time.time())
    parameters = {
        "folder": folder,
        "timestamp": timestamp,
        "use_filename": True,
        "unique_filename": True,
        "overwrite": False,
    }
    signature = cloudinary.utils.api_sign_request(
        parameters,
        settings.CLOUDINARY_API_SECRET,
    )

    return {
        "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
        "api_key": settings.CLOUDINARY_API_KEY,
        "resource_type": resource_type,
        "signature": signature,
        **parameters,
    }

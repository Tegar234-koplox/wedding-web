from __future__ import annotations

import time
from typing import Any

import cloudinary.utils
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, ValidationError

ALLOWED_UPLOAD_FOLDERS = {
    "themes": "wedding/themes",
    "samples": "wedding/samples",
    "invitations": "wedding/invitations",
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

from __future__ import annotations

import re
from urllib.parse import urlencode

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, ValidationError

from catalog.models import Package, Theme
from site_settings.models import SiteSetting


def whatsapp_redirect_url(
    *,
    locale: str,
    theme_slug: str = "",
    package_code: str = "",
) -> str:
    if locale not in {"id", "en"}:
        raise ValidationError("Unsupported locale.")
    if (
        theme_slug
        and not Theme.objects.filter(
            slug=theme_slug,
            status=Theme.Status.PUBLISHED,
        ).exists()
    ):
        raise ValidationError("Unknown theme.")
    if (
        package_code
        and not Package.objects.filter(
            code=package_code,
            is_active=True,
        ).exists()
    ):
        raise ValidationError("Unknown package.")

    number = re.sub(r"\D", "", settings.WHATSAPP_BUSINESS_NUMBER)
    if not 8 <= len(number) <= 15:
        raise ImproperlyConfigured("WhatsApp business number is not configured.")

    database_setting = SiteSetting.objects.filter(key="whatsapp").first()
    database_templates = database_setting.private_value if database_setting else {}
    template = database_templates.get(
        f"message_template_{locale}",
        settings.WHATSAPP_MESSAGE_TEMPLATE_ID
        if locale == "id"
        else settings.WHATSAPP_MESSAGE_TEMPLATE_EN,
    )
    if not template:
        template = (
            "Halo, saya tertarik dengan layanan undangan digital Niskala."
            if locale == "id"
            else "Hello, I am interested in Niskala's digital invitation service."
        )

    context = []
    if theme_slug:
        context.append(f"theme: {theme_slug}")
    if package_code:
        context.append(f"package: {package_code}")
    if context:
        template = f"{template}\n\n{', '.join(context)}"

    return f"https://wa.me/{number}?{urlencode({'text': template})}"

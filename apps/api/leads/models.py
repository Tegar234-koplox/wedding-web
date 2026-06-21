from django.db import models

from common.models import UUIDTimeStampedModel


class WhatsAppIntent(UUIDTimeStampedModel):
    theme_slug = models.SlugField(max_length=80, blank=True)
    package_code = models.SlugField(max_length=40, blank=True)
    locale = models.CharField(
        max_length=2,
        choices=[("id", "Bahasa Indonesia"), ("en", "English")],
        default="id",
    )
    campaign = models.CharField(max_length=120, blank=True)
    source = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["created_at", "theme_slug", "package_code"])]

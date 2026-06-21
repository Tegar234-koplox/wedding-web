from django.db import models

from common.models import UUIDTimeStampedModel


class SiteSetting(UUIDTimeStampedModel):
    key = models.SlugField(max_length=100, unique=True)
    public_value = models.JSONField(default=dict, blank=True)
    private_value = models.JSONField(default=dict, blank=True)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["key"]

    def __str__(self) -> str:
        return self.key

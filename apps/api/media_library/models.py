from django.core.validators import MinValueValidator
from django.db import models

from common.models import ArchivableModel, UUIDTimeStampedModel


class MediaAsset(UUIDTimeStampedModel, ArchivableModel):
    class ResourceType(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        RAW = "raw", "Raw"

    public_id = models.CharField(max_length=255, unique=True)
    resource_type = models.CharField(
        max_length=16,
        choices=ResourceType.choices,
        default=ResourceType.IMAGE,
    )
    format = models.CharField(max_length=16, blank=True)
    width = models.PositiveIntegerField(blank=True, null=True)
    height = models.PositiveIntegerField(blank=True, null=True)
    bytes = models.PositiveBigIntegerField(default=0, validators=[MinValueValidator(0)])
    checksum = models.CharField(max_length=128, blank=True)
    secure_url = models.URLField(max_length=500)
    folder = models.CharField(max_length=120, db_index=True)
    original_filename = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["resource_type", "archived_at"])]

    def __str__(self) -> str:
        return self.public_id

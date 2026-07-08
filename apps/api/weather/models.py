from django.db import models
from django.db.models import Q

from common.models import UUIDTimeStampedModel


class WeatherSnapshot(UUIDTimeStampedModel):
    adm4 = models.CharField(max_length=20, db_index=True)
    provider = models.CharField(max_length=40, default="BMKG", db_index=True)
    location_key = models.CharField(max_length=120, blank=True, db_index=True)
    analysis_at = models.DateTimeField()
    location = models.JSONField(default=dict)
    forecast = models.JSONField(default=list)
    raw_checksum = models.CharField(max_length=64)
    fetched_at = models.DateTimeField()
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ["-analysis_at", "-fetched_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["adm4", "analysis_at"],
                name="unique_weather_adm4_analysis",
            ),
            models.UniqueConstraint(
                fields=["provider", "location_key", "analysis_at"],
                condition=Q(provider="Open-Meteo"),
                name="unique_weather_provider_location_analysis",
            )
        ]
        indexes = [
            models.Index(fields=["adm4", "expires_at"]),
            models.Index(fields=["provider", "location_key", "expires_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.adm4}:{self.analysis_at.isoformat()}"


class WeatherFetchLog(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        SUCCESS = "success", "Success"
        FAILURE = "failure", "Failure"

    adm4 = models.CharField(max_length=20, db_index=True)
    provider = models.CharField(max_length=40, default="BMKG", db_index=True)
    location_key = models.CharField(max_length=120, blank=True, db_index=True)
    status = models.CharField(max_length=16, choices=Status.choices)
    latency_ms = models.PositiveIntegerField(default=0)
    failure_category = models.CharField(max_length=80, blank=True)
    analysis_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["adm4", "status", "created_at"]),
            models.Index(fields=["provider", "location_key", "status", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.adm4}:{self.status}"

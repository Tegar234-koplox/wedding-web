from django.conf import settings
from django.db import models

from common.models import UUIDTimeStampedModel


class Ticket(UUIDTimeStampedModel):
    class Category(models.TextChoices):
        TECHNICAL = "technical", "Technical"
        DNS = "dns", "DNS"
        BILLING = "billing", "Billing"
        GENERAL = "general", "General"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In progress"
        RESOLVED = "resolved", "Resolved"

    invitation = models.ForeignKey(
        "invitations.Invitation",
        on_delete=models.CASCADE,
        related_name="tickets",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_tickets",
    )
    category = models.CharField(max_length=24, choices=Category.choices)
    description = models.TextField()
    attachment_url = models.URLField(max_length=500, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.OPEN)
    assigned_staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="assigned_tickets",
    )
    resolution_note = models.TextField(blank=True)
    resolved_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["invitation", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.category}:{self.invitation_id}"

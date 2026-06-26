from django.db import models
from django.utils import timezone

from common.models import UUIDTimeStampedModel


class AnalyticsEvent(UUIDTimeStampedModel):
    class EventType(models.TextChoices):
        THEME_VIEW = "theme_view", "Theme view"
        PACKAGE_VIEW = "package_view", "Package view"
        PREVIEW_OPEN = "preview_open", "Preview open"
        WHATSAPP_CLICK = "whatsapp_click", "WhatsApp click"
        ORDER_CREATED = "order_created", "Order created"
        INVITATION_VISIT = "invitation_visit", "Invitation visit"
        RSVP_SUBMITTED = "rsvp_submitted", "RSVP submitted"

    event_type = models.CharField(max_length=40, choices=EventType.choices, db_index=True)
    resource_type = models.CharField(max_length=80, blank=True)
    resource_reference = models.CharField(max_length=160, blank=True)
    invitation = models.ForeignKey(
        "invitations.Invitation",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="analytics_events",
    )
    order = models.ForeignKey(
        "orders.Order",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="analytics_events",
    )
    whatsapp_intent = models.ForeignKey(
        "leads.WhatsAppIntent",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="analytics_events",
    )
    locale = models.CharField(max_length=2, blank=True)
    campaign = models.CharField(max_length=120, blank=True)
    source = models.CharField(max_length=120, blank=True)
    occurred_at = models.DateTimeField(default=timezone.now, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-occurred_at"]
        indexes = [models.Index(fields=["event_type", "occurred_at"])]

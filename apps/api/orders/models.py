from django.conf import settings
from django.db import models

from common.models import ArchivableModel, UUIDTimeStampedModel


class Order(UUIDTimeStampedModel, ArchivableModel):
    class Status(models.TextChoices):
        LEAD = "lead", "Lead"
        PENDING = "pending", "Pending"
        CONSULTING = "consulting", "Consulting"
        CONFIRMED = "confirmed", "Confirmed"
        IN_DESIGN = "in_design", "In design"
        CLIENT_REVIEW = "client_review", "Client review"
        REVISION = "revision", "Revision"
        APPROVED = "approved", "Approved"
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"
        PUBLISHED = "published", "Published"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    reference = models.SlugField(max_length=40, unique=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.LEAD)
    whatsapp_intent = models.ForeignKey(
        "leads.WhatsAppIntent",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="orders",
    )
    package = models.ForeignKey(
        "catalog.Package",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="orders",
    )
    theme = models.ForeignKey(
        "catalog.Theme",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="orders",
    )
    invitation = models.OneToOneField(
        "invitations.Invitation",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="order",
    )
    assigned_staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="assigned_orders",
    )
    client_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="client_orders",
    )
    client_name = models.CharField(max_length=160)
    client_email = models.EmailField(blank=True)
    client_phone = models.CharField(max_length=40, blank=True)
    event_date = models.DateField(blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="IDR")
    payment_method = models.CharField(max_length=40, default="bank_transfer")
    proof_url = models.URLField(max_length=500, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="verified_orders",
    )
    verified_at = models.DateTimeField(blank=True, null=True)
    rejection_reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["client_email", "client_phone"]),
        ]

    def __str__(self) -> str:
        return self.reference

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

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Belum Bayar"
        DP = "dp", "DP"
        PAID = "paid", "Lunas"

    class CustomStatus(models.TextChoices):
        NONE = "none", "Tidak Ada"
        REQUESTED = "requested", "Diminta"
        SCOPING = "scoping", "Briefing"
        APPROVED = "approved", "Disetujui"
        IN_PROGRESS = "in_progress", "Dikerjakan"
        READY = "ready", "Siap Review"
        REJECTED = "rejected", "Ditolak"

    reference = models.SlugField(max_length=40, unique=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.LEAD)
    payment_status = models.CharField(
        max_length=16,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        db_index=True,
    )
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
    custom_status = models.CharField(
        max_length=24,
        choices=CustomStatus.choices,
        default=CustomStatus.NONE,
        db_index=True,
    )
    custom_brief = models.TextField(blank=True)
    custom_approval_notes = models.TextField(blank=True)
    custom_checklist = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["client_email", "client_phone"]),
        ]

    def __str__(self) -> str:
        return self.reference


class BespokeScopeAgreement(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        APPROVED = "approved", "Approved"
        SUPERSEDED = "superseded", "Superseded"
        REJECTED = "rejected", "Rejected"

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="bespoke_scope_agreements",
    )
    version = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    scope = models.JSONField(default=dict)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="IDR")
    revision_limit = models.PositiveSmallIntegerField(default=8)
    production_days_min = models.PositiveSmallIntegerField(default=10)
    production_days_max = models.PositiveSmallIntegerField(default=14)
    checksum = models.CharField(max_length=64, db_index=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    approved_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-version"]
        constraints = [
            models.UniqueConstraint(
                fields=["order", "version"],
                name="unique_bespoke_scope_version",
            )
        ]


class BespokeChangeRequest(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        APPROVED = "approved", "Approved"
        APPLIED = "applied", "Applied"
        REJECTED = "rejected", "Rejected"

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="bespoke_change_requests",
    )
    scope_agreement = models.ForeignKey(
        BespokeScopeAgreement,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="change_requests",
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    description = models.TextField()
    price_delta = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    schedule_delta_days = models.PositiveSmallIntegerField(default=0)
    approved_at = models.DateTimeField(blank=True, null=True)

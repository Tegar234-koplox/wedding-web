from django.db import models

from common.models import UUIDTimeStampedModel


class PaymentInvoice(UUIDTimeStampedModel):
    class Provider(models.TextChoices):
        MIDTRANS = "midtrans", "Midtrans"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"
        EXPIRED = "expired", "Expired"
        CANCELLED = "cancelled", "Cancelled"
        REFUNDED = "refunded", "Refunded"

    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE, related_name="payments")
    provider = models.CharField(max_length=24, choices=Provider.choices, default=Provider.MIDTRANS)
    invoice_number = models.SlugField(max_length=60, unique=True)
    provider_reference = models.CharField(max_length=120, blank=True)
    idempotency_key = models.CharField(max_length=120, unique=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="IDR")
    checkout_url = models.URLField(max_length=500, blank=True)
    raw_response = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "provider"])]


class PaymentRecord(UUIDTimeStampedModel):
    class Type(models.TextChoices):
        DP = "dp", "DP"
        SETTLEMENT = "settlement", "Pelunasan"
        OTHER = "other", "Lainnya"

    class Method(models.TextChoices):
        BANK_TRANSFER = "bank_transfer", "Transfer Bank"
        QRIS = "qris", "QRIS"
        CASH = "cash", "Cash"
        OTHER = "other", "Lainnya"

    class ReviewStatus(models.TextChoices):
        PENDING = "pending", "Belum dicek"
        VALID = "valid", "Valid"
        REJECTED = "rejected", "Ditolak"

    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="manual_payments",
    )
    payment_type = models.CharField(max_length=16, choices=Type.choices, default=Type.DP)
    method = models.CharField(
        max_length=24,
        choices=Method.choices,
        default=Method.BANK_TRANSFER,
    )
    review_status = models.CharField(
        max_length=16,
        choices=ReviewStatus.choices,
        default=ReviewStatus.PENDING,
        db_index=True,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="IDR")
    proof_url = models.URLField(max_length=500, blank=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    note = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        "users.User",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="recorded_manual_payments",
    )
    reviewed_by = models.ForeignKey(
        "users.User",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_manual_payments",
    )
    reviewed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-paid_at", "-created_at"]
        indexes = [
            models.Index(fields=["order", "review_status"]),
            models.Index(fields=["payment_type", "paid_at"]),
        ]


class PaymentWebhookEvent(UUIDTimeStampedModel):
    provider = models.CharField(max_length=24, default=PaymentInvoice.Provider.MIDTRANS)
    event_id = models.CharField(max_length=160, unique=True)
    invoice = models.ForeignKey(
        PaymentInvoice,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="webhook_events",
    )
    payload = models.JSONField(default=dict)
    processed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

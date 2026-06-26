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

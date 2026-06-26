import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("orders", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="PaymentInvoice",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "provider",
                    models.CharField(
                        choices=[("midtrans", "Midtrans")],
                        default="midtrans",
                        max_length=24,
                    ),
                ),
                ("invoice_number", models.SlugField(max_length=60, unique=True)),
                ("provider_reference", models.CharField(blank=True, max_length=120)),
                ("idempotency_key", models.CharField(max_length=120, unique=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("paid", "Paid"),
                            ("failed", "Failed"),
                            ("expired", "Expired"),
                            ("cancelled", "Cancelled"),
                            ("refunded", "Refunded"),
                        ],
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("currency", models.CharField(default="IDR", max_length=3)),
                ("checkout_url", models.URLField(blank=True, max_length=500)),
                ("raw_response", models.JSONField(blank=True, default=dict)),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="payments",
                        to="orders.order",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["status", "provider"],
                        name="payments_pa_status_752a80_idx",
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="PaymentWebhookEvent",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("provider", models.CharField(default="midtrans", max_length=24)),
                ("event_id", models.CharField(max_length=160, unique=True)),
                ("payload", models.JSONField(default=dict)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "invoice",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="webhook_events",
                        to="payments.paymentinvoice",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("catalog", "0002_premium_renderer_v2"),
        ("invitations", "0003_client_rsvp_workflow"),
        ("leads", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Order",
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
                ("archived_at", models.DateTimeField(blank=True, null=True)),
                ("reference", models.SlugField(max_length=40, unique=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("lead", "Lead"),
                            ("consulting", "Consulting"),
                            ("confirmed", "Confirmed"),
                            ("in_design", "In design"),
                            ("client_review", "Client review"),
                            ("revision", "Revision"),
                            ("approved", "Approved"),
                            ("published", "Published"),
                            ("completed", "Completed"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="lead",
                        max_length=24,
                    ),
                ),
                ("client_name", models.CharField(max_length=160)),
                ("client_email", models.EmailField(blank=True, max_length=254)),
                ("client_phone", models.CharField(blank=True, max_length=40)),
                ("event_date", models.DateField(blank=True, null=True)),
                ("total_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("currency", models.CharField(default="IDR", max_length=3)),
                ("notes", models.TextField(blank=True)),
                (
                    "assigned_staff",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="assigned_orders",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "client_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="client_orders",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "invitation",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="order",
                        to="invitations.invitation",
                    ),
                ),
                (
                    "package",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="orders",
                        to="catalog.package",
                    ),
                ),
                (
                    "theme",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="orders",
                        to="catalog.theme",
                    ),
                ),
                (
                    "whatsapp_intent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="orders",
                        to="leads.whatsappintent",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["status", "created_at"],
                        name="orders_orde_status_25e057_idx",
                    ),
                    models.Index(
                        fields=["client_email", "client_phone"],
                        name="orders_orde_client__0b8f89_idx",
                    ),
                ],
            },
        ),
    ]

import uuid

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("invitations", "0003_client_rsvp_workflow"),
        ("leads", "0001_initial"),
        ("orders", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="AnalyticsEvent",
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
                    "event_type",
                    models.CharField(
                        choices=[
                            ("theme_view", "Theme view"),
                            ("package_view", "Package view"),
                            ("preview_open", "Preview open"),
                            ("whatsapp_click", "WhatsApp click"),
                            ("order_created", "Order created"),
                            ("invitation_visit", "Invitation visit"),
                            ("rsvp_submitted", "RSVP submitted"),
                        ],
                        db_index=True,
                        max_length=40,
                    ),
                ),
                ("resource_type", models.CharField(blank=True, max_length=80)),
                ("resource_reference", models.CharField(blank=True, max_length=160)),
                ("locale", models.CharField(blank=True, max_length=2)),
                ("campaign", models.CharField(blank=True, max_length=120)),
                ("source", models.CharField(blank=True, max_length=120)),
                (
                    "occurred_at",
                    models.DateTimeField(
                        db_index=True,
                        default=django.utils.timezone.now,
                    ),
                ),
                ("metadata", models.JSONField(blank=True, default=dict)),
                (
                    "invitation",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="analytics_events",
                        to="invitations.invitation",
                    ),
                ),
                (
                    "order",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="analytics_events",
                        to="orders.order",
                    ),
                ),
                (
                    "whatsapp_intent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="analytics_events",
                        to="leads.whatsappintent",
                    ),
                ),
            ],
            options={
                "ordering": ["-occurred_at"],
                "indexes": [
                    models.Index(
                        fields=["event_type", "occurred_at"],
                        name="analytics_a_event_t_69a889_idx",
                    )
                ],
            },
        ),
    ]

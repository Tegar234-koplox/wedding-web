import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0005_order_custom_approval_notes_order_custom_brief_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="BespokeScopeAgreement",
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
                ("version", models.PositiveIntegerField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("sent", "Sent"),
                            ("approved", "Approved"),
                            ("superseded", "Superseded"),
                            ("rejected", "Rejected"),
                        ],
                        default="draft",
                        max_length=16,
                    ),
                ),
                ("scope", models.JSONField(default=dict)),
                ("total_amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("currency", models.CharField(default="IDR", max_length=3)),
                ("revision_limit", models.PositiveSmallIntegerField(default=8)),
                ("production_days_min", models.PositiveSmallIntegerField(default=10)),
                ("production_days_max", models.PositiveSmallIntegerField(default=14)),
                ("checksum", models.CharField(db_index=True, max_length=64)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="bespoke_scope_agreements",
                        to="orders.order",
                    ),
                ),
            ],
            options={"ordering": ["-version"]},
        ),
        migrations.CreateModel(
            name="BespokeChangeRequest",
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
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("sent", "Sent"),
                            ("approved", "Approved"),
                            ("applied", "Applied"),
                            ("rejected", "Rejected"),
                        ],
                        default="draft",
                        max_length=16,
                    ),
                ),
                ("description", models.TextField()),
                ("price_delta", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("schedule_delta_days", models.PositiveSmallIntegerField(default=0)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="bespoke_change_requests",
                        to="orders.order",
                    ),
                ),
                (
                    "scope_agreement",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="change_requests",
                        to="orders.bespokescopeagreement",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="bespokescopeagreement",
            constraint=models.UniqueConstraint(
                fields=("order", "version"),
                name="unique_bespoke_scope_version",
            ),
        ),
    ]

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_staff_security(apps, schema_editor):
    User = apps.get_model("users", "User")
    StaffOrderAssignment = apps.get_model("users", "StaffOrderAssignment")
    Order = apps.get_model("orders", "Order")

    User.objects.filter(role="staff", is_staff=True).update(staff_role="owner")
    User.objects.filter(is_superuser=True).update(staff_role="owner")

    assignments = [
        StaffOrderAssignment(
            staff_id=staff_id,
            order_id=order_id,
            assigned_by_id=None,
        )
        for order_id, staff_id in Order.objects.exclude(assigned_staff_id=None).values_list(
            "id",
            "assigned_staff_id",
        )
    ]
    StaffOrderAssignment.objects.bulk_create(assignments, ignore_conflicts=True)


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0007_remove_bespoke_workflow_models"),
        ("users", "0004_staffmfarecoverycode"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="staff_role",
            field=models.CharField(
                choices=[
                    ("owner", "Owner"),
                    ("finance", "Finance"),
                    ("editor", "Editor"),
                    ("support", "Support"),
                    ("viewer", "Viewer"),
                ],
                default="viewer",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="staff_session_version",
            field=models.PositiveBigIntegerField(default=1, editable=False),
        ),
        migrations.CreateModel(
            name="StaffOrderAssignment",
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
                (
                    "assigned_by",
                    models.ForeignKey(
                        blank=True,
                        limit_choices_to={"is_staff": True, "role": "staff"},
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="order_assignments_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="staff_assignments",
                        to="orders.order",
                    ),
                ),
                (
                    "staff",
                    models.ForeignKey(
                        limit_choices_to={"is_staff": True, "role": "staff"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="order_assignments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="stafforderassignment",
            constraint=models.UniqueConstraint(
                fields=("staff", "order"),
                name="unique_staff_order_assignment",
            ),
        ),
        migrations.AddIndex(
            model_name="stafforderassignment",
            index=models.Index(
                fields=["staff", "order"],
                name="users_staff_staff_i_e11b69_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="stafforderassignment",
            index=models.Index(
                fields=["order", "staff"],
                name="users_staff_order_i_cfcc86_idx",
            ),
        ),
        migrations.RunPython(backfill_staff_security, migrations.RunPython.noop),
    ]

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0002_sync_linked_invitation_selection"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="payment_method",
            field=models.CharField(default="bank_transfer", max_length=40),
        ),
        migrations.AddField(
            model_name="order",
            name="proof_url",
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="order",
            name="verified_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="verified_orders",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="rejection_reason",
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("lead", "Lead"),
                    ("pending", "Pending"),
                    ("consulting", "Consulting"),
                    ("confirmed", "Confirmed"),
                    ("in_design", "In design"),
                    ("client_review", "Client review"),
                    ("revision", "Revision"),
                    ("approved", "Approved"),
                    ("verified", "Verified"),
                    ("rejected", "Rejected"),
                    ("published", "Published"),
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                ],
                default="lead",
                max_length=24,
            ),
        ),
    ]

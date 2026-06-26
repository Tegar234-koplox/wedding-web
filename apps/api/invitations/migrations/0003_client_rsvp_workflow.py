import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("invitations", "0002_premium_renderer_v2"),
    ]

    operations = [
        migrations.AddField(
            model_name="guest",
            name="anonymized_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="guest",
            name="attendance_count",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="guest",
            name="email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name="guest",
            name="phone",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name="guest",
            name="responded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="guest",
            name="retention_expires_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="guest",
            name="rsvp_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("accepted", "Accepted"),
                    ("declined", "Declined"),
                ],
                db_index=True,
                default="pending",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="guest",
            name="wishes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="invitation",
            name="approval_status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("submitted", "Submitted"),
                    ("staff_review", "Staff review"),
                    ("client_review", "Client review"),
                    ("approved_for_publish", "Approved for publish"),
                    ("published", "Published"),
                ],
                db_index=True,
                default="draft",
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name="invitation",
            name="client_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="client_invitations",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]

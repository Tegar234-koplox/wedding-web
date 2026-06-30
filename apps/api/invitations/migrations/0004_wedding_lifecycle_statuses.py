from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("invitations", "0003_client_rsvp_workflow"),
    ]

    operations = [
        migrations.AlterField(
            model_name="invitation",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("pending_payment", "Pending payment"),
                    ("pending_verification", "Pending verification"),
                    ("active", "Active"),
                    ("expiring_soon", "Expiring soon"),
                    ("review", "Review"),
                    ("published", "Published"),
                    ("expired", "Expired"),
                    ("archived", "Archived"),
                ],
                default="draft",
                max_length=24,
            ),
        ),
    ]

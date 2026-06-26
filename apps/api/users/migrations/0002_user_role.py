from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("owner", "Owner"),
                    ("admin", "Admin"),
                    ("editor", "Editor"),
                    ("support", "Support"),
                    ("viewer", "Viewer"),
                    ("client", "Client"),
                ],
                default="client",
                max_length=16,
            ),
        ),
    ]

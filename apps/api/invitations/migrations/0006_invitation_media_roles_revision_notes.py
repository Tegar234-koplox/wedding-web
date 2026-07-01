from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("invitations", "0005_invitation_custom_domain"),
    ]

    operations = [
        migrations.AddField(
            model_name="invitationrevision",
            name="is_final_check",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="invitationrevision",
            name="note",
            field=models.TextField(blank=True),
        ),
    ]

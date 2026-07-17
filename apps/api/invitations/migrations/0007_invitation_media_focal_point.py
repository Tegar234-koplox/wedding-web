from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("invitations", "0006_invitation_media_roles_revision_notes"),
    ]

    operations = [
        migrations.AddField(
            model_name="invitationmedia",
            name="focal_x",
            field=models.DecimalField(
                decimal_places=2,
                default=50,
                max_digits=5,
                validators=[MinValueValidator(0), MaxValueValidator(100)],
            ),
        ),
        migrations.AddField(
            model_name="invitationmedia",
            name="focal_y",
            field=models.DecimalField(
                decimal_places=2,
                default=50,
                max_digits=5,
                validators=[MinValueValidator(0), MaxValueValidator(100)],
            ),
        ),
    ]

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("invitations", "0009_remove_bespoke_review_models"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="invitationmedia",
            name="unique_invitation_asset_role",
        ),
    ]

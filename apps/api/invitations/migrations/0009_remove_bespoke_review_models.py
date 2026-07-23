from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("invitations", "0008_bespoke_review_publication"),
    ]

    operations = [
        migrations.DeleteModel(name="ClientApprovalRecord"),
        migrations.DeleteModel(name="ClientOtpChallenge"),
        migrations.DeleteModel(name="InvitationPublication"),
        migrations.DeleteModel(name="ClientReviewSession"),
    ]

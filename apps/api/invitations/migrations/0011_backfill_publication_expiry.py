from datetime import timedelta

from django.db import migrations
from django.utils import timezone

PUBLICATION_LIFETIME_DAYS = {
    "essential": 90,
    "signature": 180,
    "couture": 365,
}
DEFAULT_PUBLICATION_LIFETIME_DAYS = PUBLICATION_LIFETIME_DAYS["essential"]


def backfill_publication_expiry(apps, schema_editor):
    Invitation = apps.get_model("invitations", "Invitation")
    Invitation.objects.filter(is_sample=True).update(expires_at=None)
    invitations = (
        Invitation.objects.filter(
            status="published",
            is_sample=False,
            published_at__isnull=False,
        )
        .select_related("package")
        .only("id", "package_id", "package__code", "published_at")
    )
    for invitation in invitations.iterator():
        package_code = invitation.package.code if invitation.package_id else ""
        lifetime_days = PUBLICATION_LIFETIME_DAYS.get(
            package_code,
            DEFAULT_PUBLICATION_LIFETIME_DAYS,
        )
        Invitation.objects.filter(pk=invitation.pk).update(
            expires_at=invitation.published_at + timedelta(days=lifetime_days)
        )

    Invitation.objects.filter(
        status="published",
        is_sample=False,
        expires_at__lte=timezone.now(),
    ).update(status="expired")


class Migration(migrations.Migration):
    dependencies = [
        ("invitations", "0010_remove_unique_invitation_asset_role"),
    ]

    operations = [
        migrations.RunPython(backfill_publication_expiry, migrations.RunPython.noop),
    ]

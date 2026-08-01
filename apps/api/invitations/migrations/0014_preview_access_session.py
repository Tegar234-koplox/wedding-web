from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("invitations", "0013_backfill_stateful_access_grants"),
    ]

    operations = [
        migrations.AlterField(
            model_name="accesssession",
            name="kind",
            field=models.CharField(
                choices=[
                    ("client", "Client"),
                    ("guest", "Guest"),
                    ("preview", "Preview"),
                ],
                db_index=True,
                max_length=16,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="accesssession",
            name="access_session_subject_matches_kind",
        ),
        migrations.AddConstraint(
            model_name="accesssession",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(kind="guest", guest__isnull=False)
                    | (models.Q(kind__in=["client", "preview"]) & models.Q(guest__isnull=True))
                ),
                name="access_session_subject_matches_kind",
            ),
        ),
    ]

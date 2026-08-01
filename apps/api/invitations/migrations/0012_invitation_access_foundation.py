import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def populate_public_access_ids(apps, schema_editor):
    Invitation = apps.get_model("invitations", "Invitation")
    database = schema_editor.connection.alias
    for invitation_id in Invitation.objects.using(database).values_list("id", flat=True).iterator():
        Invitation.objects.using(database).filter(id=invitation_id).update(
            public_access_id=uuid.uuid4()
        )


def add_legacy_access_digest(apps, schema_editor):
    table_name = "invitations_guest"
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        columns = {
            column.name
            for column in connection.introspection.get_table_description(
                cursor,
                table_name,
            )
        }
    quoted_table = schema_editor.quote_name(table_name)
    quoted_column = schema_editor.quote_name("legacy_access_digest")
    if "legacy_access_digest" not in columns:
        schema_editor.execute(
            f"ALTER TABLE {quoted_table} ADD COLUMN {quoted_column} varchar(64) NOT NULL DEFAULT ''"
        )
    quoted_index = schema_editor.quote_name("invitations_guest_legacy_access_digest_idx")
    schema_editor.execute(
        f"CREATE INDEX IF NOT EXISTS {quoted_index} ON {quoted_table} ({quoted_column})"
    )


class Migration(migrations.Migration):
    dependencies = [
        ("invitations", "0011_backfill_publication_expiry"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="invitation",
            name="public_access_id",
            field=models.UUIDField(
                editable=False,
                null=True,
            ),
        ),
        migrations.RunPython(
            populate_public_access_ids,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="invitation",
            name="public_access_id",
            field=models.UUIDField(
                db_index=True,
                default=uuid.uuid4,
                editable=False,
                unique=True,
            ),
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    add_legacy_access_digest,
                    migrations.RunPython.noop,
                )
            ],
            state_operations=[
                migrations.AddField(
                    model_name="guest",
                    name="legacy_access_digest",
                    field=models.CharField(blank=True, db_index=True, max_length=64),
                )
            ],
        ),
        migrations.CreateModel(
            name="AccessGrant",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "purpose",
                    models.CharField(
                        choices=[
                            ("client_portal", "Client portal"),
                            ("client_preview", "Client preview"),
                            ("guest_invitation", "Guest invitation"),
                        ],
                        db_index=True,
                        max_length=32,
                    ),
                ),
                ("scopes", models.JSONField(default=list)),
                ("key_id", models.CharField(max_length=32)),
                ("secret_digest", models.CharField(max_length=64)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("revoked_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("redeemed_at", models.DateTimeField(blank=True, null=True)),
                ("last_used_at", models.DateTimeField(blank=True, null=True)),
                ("use_count", models.PositiveIntegerField(default=0)),
                ("version", models.PositiveIntegerField(default=1)),
                ("one_time", models.BooleanField(default=False)),
                (
                    "guest",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="access_grants",
                        to="invitations.guest",
                    ),
                ),
                (
                    "invitation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="access_grants",
                        to="invitations.invitation",
                    ),
                ),
                (
                    "issued_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="issued_invitation_access_grants",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "rotated_from",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="rotations",
                        to="invitations.accessgrant",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="AccessSession",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "kind",
                    models.CharField(
                        choices=[("client", "Client"), ("guest", "Guest")],
                        db_index=True,
                        max_length=16,
                    ),
                ),
                ("session_digest", models.CharField(max_length=64, unique=True)),
                ("scopes", models.JSONField(default=list)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("idle_expires_at", models.DateTimeField(db_index=True)),
                ("last_seen_at", models.DateTimeField()),
                ("revoked_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("user_agent_digest", models.CharField(blank=True, max_length=64)),
                (
                    "grant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sessions",
                        to="invitations.accessgrant",
                    ),
                ),
                (
                    "guest",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="access_sessions",
                        to="invitations.guest",
                    ),
                ),
                (
                    "invitation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="access_sessions",
                        to="invitations.invitation",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="ClientPortalCredential",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("pin_hash", models.CharField(max_length=256)),
                ("must_change_pin", models.BooleanField(default=True)),
                ("failed_attempts", models.PositiveSmallIntegerField(default=0)),
                ("locked_until", models.DateTimeField(blank=True, null=True)),
                ("rotated_at", models.DateTimeField(blank=True, null=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_client_portal_credentials",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "invitation",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="client_portal_credential",
                        to="invitations.invitation",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="GuestRSVPHistory",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "previous_status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("accepted", "Accepted"),
                            ("declined", "Declined"),
                        ],
                        max_length=16,
                    ),
                ),
                (
                    "next_status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("accepted", "Accepted"),
                            ("declined", "Declined"),
                        ],
                        max_length=16,
                    ),
                ),
                ("previous_attendance_count", models.PositiveSmallIntegerField(default=0)),
                ("next_attendance_count", models.PositiveSmallIntegerField(default=0)),
                ("source", models.CharField(default="guest_session", max_length=32)),
                (
                    "grant",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="rsvp_history",
                        to="invitations.accessgrant",
                    ),
                ),
                (
                    "guest",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="rsvp_history",
                        to="invitations.guest",
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="accessgrant",
            index=models.Index(
                fields=["invitation", "purpose", "revoked_at"],
                name="invitations_invitat_7ccccb_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="accessgrant",
            index=models.Index(
                fields=["guest", "purpose", "revoked_at"],
                name="invitations_guest_i_7e7041_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="accessgrant",
            index=models.Index(
                fields=["expires_at", "revoked_at"],
                name="invitations_expires_2d35c6_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="accessgrant",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(purpose="guest_invitation", guest__isnull=False)
                    | (~models.Q(purpose="guest_invitation") & models.Q(guest__isnull=True))
                ),
                name="guest_grant_requires_guest",
            ),
        ),
        migrations.AddConstraint(
            model_name="accessgrant",
            constraint=models.UniqueConstraint(
                condition=models.Q(revoked_at__isnull=True),
                fields=("guest", "purpose"),
                name="one_active_grant_per_guest_purpose",
            ),
        ),
        migrations.AddConstraint(
            model_name="accessgrant",
            constraint=models.UniqueConstraint(
                condition=(models.Q(guest__isnull=True) & models.Q(revoked_at__isnull=True)),
                fields=("invitation", "purpose"),
                name="one_active_invitation_grant_per_purpose",
            ),
        ),
        migrations.AddIndex(
            model_name="accesssession",
            index=models.Index(
                fields=["invitation", "kind", "revoked_at"],
                name="invitations_invitat_c82025_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="accesssession",
            index=models.Index(
                fields=["expires_at", "idle_expires_at", "revoked_at"],
                name="invitations_expires_8ec33f_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="accesssession",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(kind="guest", guest__isnull=False)
                    | models.Q(kind="client", guest__isnull=True)
                ),
                name="access_session_subject_matches_kind",
            ),
        ),
    ]

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("invitations", "0007_invitation_media_focal_point"),
        ("orders", "0006_bespoke_scope_agreements"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClientReviewSession",
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
                        choices=[("scope", "Scope approval"), ("final", "Final approval")],
                        max_length=16,
                    ),
                ),
                ("token_hash", models.CharField(max_length=64, unique=True)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                (
                    "invitation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="review_sessions",
                        to="invitations.invitation",
                    ),
                ),
                (
                    "revision",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="review_sessions",
                        to="invitations.invitationrevision",
                    ),
                ),
                (
                    "scope_agreement",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="review_sessions",
                        to="orders.bespokescopeagreement",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="ClientOtpChallenge",
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
                    "channel",
                    models.CharField(
                        choices=[("whatsapp", "WhatsApp"), ("email", "Email")],
                        max_length=16,
                    ),
                ),
                ("destination_hash", models.CharField(max_length=64)),
                ("destination_masked", models.CharField(max_length=160)),
                ("code_hash", models.CharField(max_length=128)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                (
                    "delivery_status",
                    models.CharField(
                        choices=[("queued", "Queued"), ("sent", "Sent"), ("failed", "Failed")],
                        default="queued",
                        max_length=16,
                    ),
                ),
                ("consumed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "review_session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="otp_challenges",
                        to="invitations.clientreviewsession",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="ClientApprovalRecord",
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
                ("checksum", models.CharField(db_index=True, max_length=64)),
                (
                    "channel",
                    models.CharField(
                        choices=[("whatsapp", "WhatsApp"), ("email", "Email")],
                        max_length=16,
                    ),
                ),
                ("contact_masked", models.CharField(max_length=160)),
                ("ip_hash", models.CharField(blank=True, max_length=64)),
                ("user_agent", models.CharField(blank=True, max_length=300)),
                ("approved_at", models.DateTimeField()),
                (
                    "review_session",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="approval_record",
                        to="invitations.clientreviewsession",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="InvitationPublication",
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
                ("publication_number", models.PositiveIntegerField()),
                ("snapshot", models.JSONField()),
                ("checksum", models.CharField(db_index=True, max_length=64)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("published_at", models.DateTimeField()),
                (
                    "invitation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="publications",
                        to="invitations.invitation",
                    ),
                ),
                (
                    "published_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="invitation_publications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "revision",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="publications",
                        to="invitations.invitationrevision",
                    ),
                ),
            ],
            options={"ordering": ["-publication_number"]},
        ),
        migrations.AddConstraint(
            model_name="invitationpublication",
            constraint=models.UniqueConstraint(
                fields=("invitation", "publication_number"),
                name="unique_invitation_publication_number",
            ),
        ),
        migrations.AddConstraint(
            model_name="invitationpublication",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_active", True)),
                fields=("invitation",),
                name="one_active_invitation_publication",
            ),
        ),
    ]

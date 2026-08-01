import hashlib
import uuid

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from common.models import ArchivableModel, UUIDTimeStampedModel
from common.validators import validate_invitation_content, validate_renderer_key


class Invitation(UUIDTimeStampedModel, ArchivableModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_PAYMENT = "pending_payment", "Pending payment"
        PENDING_VERIFICATION = "pending_verification", "Pending verification"
        ACTIVE = "active", "Active"
        EXPIRING_SOON = "expiring_soon", "Expiring soon"
        REVIEW = "review", "Review"
        PUBLISHED = "published", "Published"
        EXPIRED = "expired", "Expired"
        ARCHIVED = "archived", "Archived"

    class ApprovalStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        STAFF_REVIEW = "staff_review", "Staff review"
        CLIENT_REVIEW = "client_review", "Client review"
        APPROVED_FOR_PUBLISH = "approved_for_publish", "Approved for publish"
        PUBLISHED = "published", "Published"

    public_slug = models.SlugField(max_length=100, unique=True)
    public_access_id = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True,
    )
    theme = models.ForeignKey(
        "catalog.Theme",
        on_delete=models.PROTECT,
        related_name="invitations",
    )
    package = models.ForeignKey(
        "catalog.Package",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="invitations",
    )
    renderer_key = models.CharField(max_length=80, validators=[validate_renderer_key])
    renderer_version = models.PositiveSmallIntegerField(default=2)
    content_schema_version = models.PositiveSmallIntegerField(default=1)
    default_locale = models.CharField(
        max_length=2,
        choices=[("id", "Bahasa Indonesia"), ("en", "English")],
        default="id",
    )
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.DRAFT)
    approval_status = models.CharField(
        max_length=24,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.DRAFT,
        db_index=True,
    )
    client_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="client_invitations",
    )
    is_sample = models.BooleanField(default=False, db_index=True)
    published_at = models.DateTimeField(blank=True, null=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    custom_domain = models.CharField(max_length=255, blank=True, db_index=True)
    content = models.JSONField(default=dict, validators=[validate_invitation_content])

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "published_at"]),
            models.Index(fields=["public_slug", "status"]),
        ]

    def __str__(self) -> str:
        return self.public_slug


class WeddingEvent(UUIDTimeStampedModel):
    class EventType(models.TextChoices):
        CEREMONY = "ceremony", "Ceremony"
        RECEPTION = "reception", "Reception"
        OTHER = "other", "Other"

    invitation = models.ForeignKey(Invitation, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=16, choices=EventType.choices)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(blank=True, null=True)
    timezone = models.CharField(max_length=64, default="Asia/Jakarta")
    venue_name = models.CharField(max_length=180)
    address = models.TextField()
    map_url = models.URLField(max_length=500, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "starts_at"]


class EventLocation(UUIDTimeStampedModel):
    event = models.OneToOneField(
        WeddingEvent,
        on_delete=models.CASCADE,
        related_name="location",
    )
    province = models.CharField(max_length=100)
    regency = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    village = models.CharField(max_length=100)
    bmkg_adm4 = models.CharField(max_length=20, blank=True, db_index=True)
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )


class InvitationMedia(UUIDTimeStampedModel):
    class Role(models.TextChoices):
        PHOTO = "photo", "Photo"
        GALLERY = "gallery", "Gallery"
        BACKSOUND = "backsound", "Backsound"

    invitation = models.ForeignKey(Invitation, on_delete=models.CASCADE, related_name="media")
    asset = models.ForeignKey(
        "media_library.MediaAsset",
        on_delete=models.PROTECT,
        related_name="invitation_usages",
    )
    role = models.CharField(max_length=40)
    sort_order = models.PositiveSmallIntegerField(default=0)
    alt_text = models.JSONField(default=dict)
    focal_x = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=50,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    focal_y = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=50,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )

    class Meta:
        ordering = ["sort_order", "created_at"]


class Guest(UUIDTimeStampedModel, ArchivableModel):
    class RSVPStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"

    invitation = models.ForeignKey(Invitation, on_delete=models.CASCADE, related_name="guests")
    access_token_hash = models.CharField(max_length=128, unique=True)
    legacy_access_digest = models.CharField(max_length=64, blank=True, db_index=True)
    display_name = models.CharField(max_length=120)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    party_size = models.PositiveSmallIntegerField(default=1)
    rsvp_status = models.CharField(
        max_length=16,
        choices=RSVPStatus.choices,
        default=RSVPStatus.PENDING,
        db_index=True,
    )
    attendance_count = models.PositiveSmallIntegerField(default=0)
    wishes = models.TextField(blank=True)
    responded_at = models.DateTimeField(blank=True, null=True)
    anonymized_at = models.DateTimeField(blank=True, null=True)
    retention_expires_at = models.DateTimeField(blank=True, null=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    def save(self, *args, **kwargs):
        stored = str(self.access_token_hash or "")
        if stored and not stored.startswith(("!", "pbkdf2_", "argon2", "bcrypt", "md5$")):
            self.legacy_access_digest = hashlib.sha256(stored.encode()).hexdigest()
            self.access_token_hash = make_password(stored)
            update_fields = kwargs.get("update_fields")
            if update_fields is not None:
                kwargs["update_fields"] = set(update_fields) | {
                    "access_token_hash",
                    "legacy_access_digest",
                }
        return super().save(*args, **kwargs)

    def anonymize(self) -> None:
        self.display_name = "Anonymized guest"
        self.email = ""
        self.phone = ""
        self.wishes = ""
        self.metadata = {}
        from django.utils import timezone

        self.anonymized_at = timezone.now()


class AccessGrant(UUIDTimeStampedModel):
    class Purpose(models.TextChoices):
        CLIENT_PORTAL = "client_portal", "Client portal"
        CLIENT_PREVIEW = "client_preview", "Client preview"
        GUEST_INVITATION = "guest_invitation", "Guest invitation"

    invitation = models.ForeignKey(
        Invitation,
        on_delete=models.CASCADE,
        related_name="access_grants",
    )
    guest = models.ForeignKey(
        Guest,
        blank=True,
        null=True,
        on_delete=models.CASCADE,
        related_name="access_grants",
    )
    purpose = models.CharField(max_length=32, choices=Purpose.choices, db_index=True)
    scopes = models.JSONField(default=list)
    key_id = models.CharField(max_length=32)
    secret_digest = models.CharField(max_length=64)
    expires_at = models.DateTimeField(db_index=True)
    revoked_at = models.DateTimeField(blank=True, null=True, db_index=True)
    redeemed_at = models.DateTimeField(blank=True, null=True)
    last_used_at = models.DateTimeField(blank=True, null=True)
    use_count = models.PositiveIntegerField(default=0)
    version = models.PositiveIntegerField(default=1)
    one_time = models.BooleanField(default=False)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="issued_invitation_access_grants",
    )
    rotated_from = models.ForeignKey(
        "self",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="rotations",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["invitation", "purpose", "revoked_at"]),
            models.Index(fields=["guest", "purpose", "revoked_at"]),
            models.Index(fields=["expires_at", "revoked_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(purpose="guest_invitation", guest__isnull=False)
                    | (~models.Q(purpose="guest_invitation") & models.Q(guest__isnull=True))
                ),
                name="guest_grant_requires_guest",
            ),
            models.UniqueConstraint(
                fields=["guest", "purpose"],
                condition=models.Q(revoked_at__isnull=True),
                name="one_active_grant_per_guest_purpose",
            ),
            models.UniqueConstraint(
                fields=["invitation", "purpose"],
                condition=(models.Q(guest__isnull=True) & models.Q(revoked_at__isnull=True)),
                name="one_active_invitation_grant_per_purpose",
            ),
        ]


class ClientPortalCredential(UUIDTimeStampedModel):
    invitation = models.OneToOneField(
        Invitation,
        on_delete=models.CASCADE,
        related_name="client_portal_credential",
    )
    pin_hash = models.CharField(max_length=256)
    must_change_pin = models.BooleanField(default=True)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(blank=True, null=True)
    rotated_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="created_client_portal_credentials",
    )


class AccessSession(UUIDTimeStampedModel):
    class Kind(models.TextChoices):
        CLIENT = "client", "Client"
        GUEST = "guest", "Guest"
        PREVIEW = "preview", "Preview"

    kind = models.CharField(max_length=16, choices=Kind.choices, db_index=True)
    invitation = models.ForeignKey(
        Invitation,
        on_delete=models.CASCADE,
        related_name="access_sessions",
    )
    guest = models.ForeignKey(
        Guest,
        blank=True,
        null=True,
        on_delete=models.CASCADE,
        related_name="access_sessions",
    )
    grant = models.ForeignKey(
        AccessGrant,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    session_digest = models.CharField(max_length=64, unique=True)
    scopes = models.JSONField(default=list)
    expires_at = models.DateTimeField(db_index=True)
    idle_expires_at = models.DateTimeField(db_index=True)
    last_seen_at = models.DateTimeField()
    revoked_at = models.DateTimeField(blank=True, null=True, db_index=True)
    user_agent_digest = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["invitation", "kind", "revoked_at"]),
            models.Index(fields=["expires_at", "idle_expires_at", "revoked_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(kind="guest", guest__isnull=False)
                    | (models.Q(kind__in=["client", "preview"]) & models.Q(guest__isnull=True))
                ),
                name="access_session_subject_matches_kind",
            )
        ]


class GuestRSVPHistory(UUIDTimeStampedModel):
    guest = models.ForeignKey(Guest, on_delete=models.CASCADE, related_name="rsvp_history")
    grant = models.ForeignKey(
        AccessGrant,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="rsvp_history",
    )
    previous_status = models.CharField(max_length=16, choices=Guest.RSVPStatus.choices)
    next_status = models.CharField(max_length=16, choices=Guest.RSVPStatus.choices)
    previous_attendance_count = models.PositiveSmallIntegerField(default=0)
    next_attendance_count = models.PositiveSmallIntegerField(default=0)
    source = models.CharField(max_length=32, default="guest_session")


class InvitationRevision(UUIDTimeStampedModel):
    invitation = models.ForeignKey(Invitation, on_delete=models.CASCADE, related_name="revisions")
    revision_number = models.PositiveIntegerField()
    content = models.JSONField(validators=[validate_invitation_content])
    note = models.TextField(blank=True)
    is_final_check = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="invitation_revisions",
    )

    class Meta:
        ordering = ["-revision_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["invitation", "revision_number"],
                name="unique_invitation_revision_number",
            )
        ]

import hashlib
import hmac
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import migrations
from django.utils import timezone

HASH_PREFIXES = ("pbkdf2_", "argon2", "bcrypt", "md5$")


def _digest(*, grant_id, version, purpose, key_id, keys):
    key = str(keys[key_id]).encode()
    material = f"{grant_id}:{version}:{purpose}".encode()
    secret = hmac.new(key, material, hashlib.sha256).digest()
    import base64

    encoded_secret = base64.urlsafe_b64encode(secret).decode().rstrip("=")
    return hmac.new(key, encoded_secret.encode(), hashlib.sha256).hexdigest()


def backfill_stateful_access(apps, schema_editor):
    Invitation = apps.get_model("invitations", "Invitation")
    Guest = apps.get_model("invitations", "Guest")
    AccessGrant = apps.get_model("invitations", "AccessGrant")
    keys = getattr(settings, "CAPABILITY_KEYS", {})
    primary_key_id = str(getattr(settings, "CAPABILITY_PRIMARY_KEY_ID", ""))
    if not isinstance(keys, dict) or primary_key_id not in keys:
        raise RuntimeError("Capability keyring must be configured before access-grant migration")

    now = timezone.now()
    for invitation in Invitation.objects.filter(archived_at__isnull=True).iterator():
        if invitation.status != "published" and not invitation.is_sample:
            grant_id = uuid.uuid4()
            purpose = "client_preview"
            expiry = min(
                invitation.expires_at or now + timedelta(days=7),
                now + timedelta(days=7),
            )
            AccessGrant.objects.create(
                id=grant_id,
                invitation_id=invitation.id,
                purpose=purpose,
                scopes=["invitation:read", "preview:read"],
                key_id=primary_key_id,
                secret_digest=_digest(
                    grant_id=grant_id,
                    version=1,
                    purpose=purpose,
                    key_id=primary_key_id,
                    keys=keys,
                ),
                expires_at=expiry,
            )

    for guest in (
        Guest.objects.filter(
            archived_at__isnull=True,
            anonymized_at__isnull=True,
        )
        .select_related("invitation")
        .iterator()
    ):
        grant_id = uuid.uuid4()
        purpose = "guest_invitation"
        AccessGrant.objects.create(
            id=grant_id,
            invitation_id=guest.invitation_id,
            guest_id=guest.id,
            purpose=purpose,
            scopes=["invitation:read", "guest:self", "rsvp:write", "wishes:write"],
            key_id=primary_key_id,
            secret_digest=_digest(
                grant_id=grant_id,
                version=1,
                purpose=purpose,
                key_id=primary_key_id,
                keys=keys,
            ),
            expires_at=guest.invitation.expires_at or now + timedelta(days=30),
            one_time=True,
        )
        metadata = dict(guest.metadata or {})
        raw_delivery_token = str(metadata.pop("delivery_token", "") or "")
        stored = str(guest.access_token_hash or "")
        legacy_token = raw_delivery_token or ("" if stored.startswith(HASH_PREFIXES) else stored)
        guest.legacy_access_digest = (
            hashlib.sha256(legacy_token.encode()).hexdigest() if legacy_token else ""
        )
        guest.access_token_hash = (
            stored if stored.startswith(HASH_PREFIXES) else make_password(legacy_token or stored)
        )
        guest.metadata = metadata
        guest.save(
            update_fields=[
                "access_token_hash",
                "legacy_access_digest",
                "metadata",
                "updated_at",
            ]
        )


class Migration(migrations.Migration):
    dependencies = [
        ("invitations", "0012_invitation_access_foundation"),
    ]

    operations = [
        migrations.RunPython(backfill_stateful_access, migrations.RunPython.noop),
    ]

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from invitations.models import (
    AccessGrant,
    AccessSession,
    ClientPortalCredential,
    Guest,
    Invitation,
)

CLIENT_SESSION_COOKIE = "__Host-niskala_client"
GUEST_SESSION_COOKIE = "__Host-niskala_guest"
PREVIEW_SESSION_COOKIE = "__Host-niskala_preview"
CLIENT_GRACE_PERIOD = timedelta(days=30)
CLIENT_BOOTSTRAP_MAX_AGE = timedelta(hours=24)
CLIENT_SESSION_MAX_AGE = timedelta(hours=12)
CLIENT_SESSION_IDLE_AGE = timedelta(minutes=30)
GUEST_SESSION_MAX_AGE = timedelta(days=30)
GUEST_SESSION_IDLE_AGE = timedelta(days=7)
PREVIEW_GRANT_MAX_AGE = timedelta(days=7)
PREVIEW_SESSION_MAX_AGE = timedelta(hours=1)
PREVIEW_SESSION_IDLE_AGE = timedelta(minutes=15)
PIN_LOCK_AGE = timedelta(minutes=15)
PIN_LOCK_THRESHOLD = 5
PIN_REVOKE_THRESHOLD = 10
MAX_ACTIVE_SESSIONS = 2

CLIENT_SCOPES = [
    "invitation:read",
    "preview:read",
    "guests:read",
    "guests:write",
    "guests:export",
    "wishes:read",
]
GUEST_SCOPES = ["invitation:read", "guest:self", "rsvp:write", "wishes:write"]
PREVIEW_SCOPES = ["invitation:read", "preview:read"]


class AccessDenied(Exception):
    pass


@dataclass(frozen=True)
class IssuedAccess:
    grant: AccessGrant
    token: str
    initial_pin: str | None = None


@dataclass(frozen=True)
class AuthenticatedAccess:
    session: AccessSession
    raw_token: str

    @property
    def invitation(self) -> Invitation:
        return self.session.invitation

    @property
    def guest(self) -> Guest | None:
        return self.session.guest

    @property
    def is_read_only(self) -> bool:
        invitation = self.invitation
        return bool(invitation.expires_at and timezone.now() >= invitation.expires_at)


def _keyring() -> dict[str, bytes]:
    configured = getattr(settings, "CAPABILITY_KEYS", {})
    if not isinstance(configured, dict) or not configured:
        raise RuntimeError("CAPABILITY_KEYS must contain at least one key")
    return {str(key_id): str(value).encode() for key_id, value in configured.items()}


def legacy_link_allowed() -> bool:
    if not bool(getattr(settings, "LEGACY_INVITATION_LINKS_ENABLED", True)):
        return False
    raw_cutoff = str(getattr(settings, "LEGACY_INVITATION_LINK_CUTOFF", "")).strip()
    if not raw_cutoff:
        return bool(getattr(settings, "DEBUG", False))
    cutoff = parse_datetime(raw_cutoff)
    if cutoff is None:
        raise RuntimeError("LEGACY_INVITATION_LINK_CUTOFF must be an ISO-8601 datetime")
    if timezone.is_naive(cutoff):
        cutoff = timezone.make_aware(cutoff)
    return timezone.now() < cutoff


def legacy_guest_token_digest(token: str) -> str:
    return hashlib.sha256(str(token or "").encode()).hexdigest()


def legacy_guest_for_token(invitation: Invitation, token: str) -> Guest | None:
    if not token or not legacy_link_allowed():
        return None
    guest = (
        Guest.objects.filter(
            invitation=invitation,
            legacy_access_digest=legacy_guest_token_digest(token),
            archived_at__isnull=True,
            anonymized_at__isnull=True,
        )
        .order_by("created_at")
        .first()
    )
    if guest is None:
        return None
    stored = str(guest.access_token_hash or "")
    valid = (
        False
        if stored.startswith("!")
        else (
            check_password(token, stored)
            if stored.startswith(("pbkdf2_", "argon2", "bcrypt", "md5$"))
            else hmac.compare_digest(stored, token)
        )
    )
    return guest if valid else None


def _primary_key_id() -> str:
    key_id = str(getattr(settings, "CAPABILITY_PRIMARY_KEY_ID", "")).strip()
    if key_id not in _keyring():
        raise RuntimeError("CAPABILITY_PRIMARY_KEY_ID is not present in CAPABILITY_KEYS")
    return key_id


def _key(key_id: str) -> bytes:
    try:
        return _keyring()[key_id]
    except KeyError as exc:
        raise AccessDenied("Unknown capability key.") from exc


def _urlsafe(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _derived_grant_secret(grant: AccessGrant) -> str:
    material = f"{grant.id}:{grant.version}:{grant.purpose}".encode()
    return _urlsafe(hmac.new(_key(grant.key_id), material, hashlib.sha256).digest())


def _grant_digest(grant: AccessGrant, secret: str) -> str:
    return hmac.new(_key(grant.key_id), secret.encode(), hashlib.sha256).hexdigest()


def grant_token(grant: AccessGrant) -> str:
    return f"ng1.{grant.id}.{_derived_grant_secret(grant)}"


def parse_grant_token(token: str) -> tuple[UUID, str] | None:
    parts = str(token or "").split(".")
    if len(parts) != 3 or parts[0] != "ng1":
        return None
    try:
        return UUID(parts[1]), parts[2]
    except (TypeError, ValueError):
        return None


def _grant_expiry(invitation: Invitation, fallback: timedelta) -> datetime:
    if invitation.expires_at:
        return invitation.expires_at
    return timezone.now() + fallback


def create_grant(
    *,
    invitation: Invitation,
    purpose: str,
    scopes: Iterable[str],
    expires_at,
    issued_by=None,
    guest: Guest | None = None,
    one_time: bool = False,
    rotated_from: AccessGrant | None = None,
) -> AccessGrant:
    grant = AccessGrant(
        invitation=invitation,
        guest=guest,
        purpose=purpose,
        scopes=list(scopes),
        key_id=_primary_key_id(),
        secret_digest="",
        expires_at=expires_at,
        issued_by=issued_by,
        one_time=one_time,
        rotated_from=rotated_from,
    )
    secret = _derived_grant_secret(grant)
    grant.secret_digest = _grant_digest(grant, secret)
    grant.save()
    return grant


def validate_grant_token(
    token: str,
    *,
    purposes: Iterable[str] | None = None,
    consume: bool = False,
) -> AccessGrant:
    parsed = parse_grant_token(token)
    if parsed is None:
        raise AccessDenied("Invalid access grant.")
    grant_id, secret = parsed
    with transaction.atomic():
        grant = (
            AccessGrant.objects.select_for_update(of=("self",))
            .select_related("invitation", "guest")
            .filter(id=grant_id)
            .first()
        )
        now = timezone.now()
        allowed_purposes = set(purposes or [])
        if (
            grant is None
            or (allowed_purposes and grant.purpose not in allowed_purposes)
            or grant.revoked_at is not None
            or grant.expires_at <= now
            or grant.invitation.archived_at is not None
            or (grant.one_time and grant.redeemed_at is not None)
        ):
            raise AccessDenied("Invalid access grant.")
        expected = grant.secret_digest
        supplied = _grant_digest(grant, secret)
        if not hmac.compare_digest(expected, supplied):
            raise AccessDenied("Invalid access grant.")
        grant.last_used_at = now
        grant.use_count += 1
        update_fields = ["last_used_at", "use_count", "updated_at"]
        if consume:
            grant.redeemed_at = now
            update_fields.append("redeemed_at")
        grant.save(update_fields=update_fields)
        return grant


def issue_client_portal_access(invitation: Invitation, *, actor) -> IssuedAccess:
    now = timezone.now()
    initial_pin = "".join(secrets.choice("23456789ABCDEFGHJKLMNPQRSTUVWXYZ") for _ in range(10))
    with transaction.atomic():
        locked_invitation = Invitation.objects.select_for_update().get(pk=invitation.pk)
        expires_at = min(
            now + CLIENT_BOOTSTRAP_MAX_AGE,
            locked_invitation.expires_at + CLIENT_GRACE_PERIOD
            if locked_invitation.expires_at
            else now + CLIENT_BOOTSTRAP_MAX_AGE,
        )
        AccessGrant.objects.filter(
            invitation=locked_invitation,
            purpose=AccessGrant.Purpose.CLIENT_PORTAL,
            revoked_at__isnull=True,
        ).update(revoked_at=now, updated_at=now)
        AccessSession.objects.filter(
            invitation=locked_invitation,
            kind=AccessSession.Kind.CLIENT,
            revoked_at__isnull=True,
        ).update(revoked_at=now, updated_at=now)
        ClientPortalCredential.objects.update_or_create(
            invitation=locked_invitation,
            defaults={
                "pin_hash": make_password(initial_pin),
                "must_change_pin": True,
                "failed_attempts": 0,
                "locked_until": None,
                "rotated_at": now,
                "created_by": actor,
            },
        )
        grant = create_grant(
            invitation=locked_invitation,
            purpose=AccessGrant.Purpose.CLIENT_PORTAL,
            scopes=CLIENT_SCOPES,
            expires_at=expires_at,
            issued_by=actor,
            one_time=True,
        )
    return IssuedAccess(grant=grant, token=grant_token(grant), initial_pin=initial_pin)


def ensure_preview_grant(invitation: Invitation, *, actor=None) -> AccessGrant:
    now = timezone.now()
    with transaction.atomic():
        locked_invitation = Invitation.objects.select_for_update().get(pk=invitation.pk)
        grants = AccessGrant.objects.filter(
            invitation=locked_invitation,
            purpose=AccessGrant.Purpose.CLIENT_PREVIEW,
            revoked_at__isnull=True,
        ).order_by("-created_at")
        active = grants.filter(expires_at__gt=now).first()
        if active is not None:
            grants.exclude(pk=active.pk).update(revoked_at=now, updated_at=now)
            return active
        grants.update(revoked_at=now, updated_at=now)
        return create_grant(
            invitation=locked_invitation,
            purpose=AccessGrant.Purpose.CLIENT_PREVIEW,
            scopes=PREVIEW_SCOPES,
            expires_at=min(
                _grant_expiry(locked_invitation, PREVIEW_GRANT_MAX_AGE),
                now + PREVIEW_GRANT_MAX_AGE,
            ),
            issued_by=actor,
        )


def rotate_preview_grant(invitation: Invitation, *, actor=None) -> AccessGrant:
    now = timezone.now()
    with transaction.atomic():
        locked_invitation = Invitation.objects.select_for_update().get(pk=invitation.pk)
        grants = AccessGrant.objects.filter(
            invitation=locked_invitation,
            purpose=AccessGrant.Purpose.CLIENT_PREVIEW,
            revoked_at__isnull=True,
        ).order_by("-created_at")
        previous = grants.first()
        grants.update(revoked_at=now, updated_at=now)
        return create_grant(
            invitation=locked_invitation,
            purpose=AccessGrant.Purpose.CLIENT_PREVIEW,
            scopes=PREVIEW_SCOPES,
            expires_at=min(
                _grant_expiry(locked_invitation, PREVIEW_GRANT_MAX_AGE),
                now + PREVIEW_GRANT_MAX_AGE,
            ),
            issued_by=actor,
            rotated_from=previous,
        )


def revoke_preview_grants(invitation: Invitation) -> None:
    now = timezone.now()
    AccessGrant.objects.filter(
        invitation=invitation,
        purpose=AccessGrant.Purpose.CLIENT_PREVIEW,
        revoked_at__isnull=True,
    ).update(revoked_at=now, updated_at=now)


def align_invitation_access_expiry(invitation: Invitation) -> None:
    if invitation.expires_at is None:
        return
    now = timezone.now()
    client_grants = AccessGrant.objects.filter(
        invitation=invitation,
        purpose=AccessGrant.Purpose.CLIENT_PORTAL,
        revoked_at__isnull=True,
    )
    client_grants.filter(redeemed_at__isnull=False).update(
        expires_at=invitation.expires_at + CLIENT_GRACE_PERIOD,
        updated_at=now,
    )
    client_grants.filter(
        redeemed_at__isnull=True,
        expires_at__gt=invitation.expires_at + CLIENT_GRACE_PERIOD,
    ).update(
        expires_at=invitation.expires_at + CLIENT_GRACE_PERIOD,
        updated_at=now,
    )
    AccessGrant.objects.filter(
        invitation=invitation,
        purpose=AccessGrant.Purpose.GUEST_INVITATION,
        revoked_at__isnull=True,
    ).update(expires_at=invitation.expires_at, updated_at=now)
    AccessSession.objects.filter(
        invitation=invitation,
        kind=AccessSession.Kind.GUEST,
        revoked_at__isnull=True,
        expires_at__gt=invitation.expires_at,
    ).update(expires_at=invitation.expires_at, updated_at=now)


def ensure_guest_grant(guest: Guest, *, actor=None, rotate: bool = False) -> AccessGrant:
    now = timezone.now()
    with transaction.atomic():
        locked_guest = (
            Guest.objects.select_for_update().select_related("invitation").get(pk=guest.pk)
        )
        if locked_guest.archived_at is not None or locked_guest.anonymized_at is not None:
            raise AccessDenied("Guest access is unavailable.")
        grants = AccessGrant.objects.filter(
            guest=locked_guest,
            purpose=AccessGrant.Purpose.GUEST_INVITATION,
            revoked_at__isnull=True,
        ).order_by("-created_at")
        active = grants.filter(expires_at__gt=now).first()
        if active is not None and not rotate:
            grants.exclude(pk=active.pk).update(revoked_at=now, updated_at=now)
            return active

        previous = active or grants.first()
        grants.update(revoked_at=now, updated_at=now)
        if rotate:
            locked_guest.access_token_hash = make_password(None)
            locked_guest.legacy_access_digest = ""
            locked_guest.save(
                update_fields=[
                    "access_token_hash",
                    "legacy_access_digest",
                    "updated_at",
                ]
            )
        return create_grant(
            invitation=locked_guest.invitation,
            guest=locked_guest,
            purpose=AccessGrant.Purpose.GUEST_INVITATION,
            scopes=GUEST_SCOPES,
            expires_at=_grant_expiry(
                locked_guest.invitation,
                GUEST_SESSION_MAX_AGE,
            ),
            issued_by=actor,
            one_time=True,
            rotated_from=previous,
        )


def _session_token() -> tuple[str, str, str]:
    key_id = _primary_key_id()
    secret = _urlsafe(secrets.token_bytes(32))
    raw = f"ns1.{key_id}.{secret}"
    digest = hmac.new(_key(key_id), raw.encode(), hashlib.sha256).hexdigest()
    return raw, key_id, digest


def _session_digest(raw_token: str) -> str | None:
    parts = str(raw_token or "").split(".")
    if len(parts) != 3 or parts[0] != "ns1":
        return None
    try:
        return hmac.new(_key(parts[1]), raw_token.encode(), hashlib.sha256).hexdigest()
    except AccessDenied:
        return None


def create_access_session(
    grant: AccessGrant,
    *,
    kind: str,
    user_agent: str = "",
) -> AuthenticatedAccess:
    now = timezone.now()
    raw_token, _, digest = _session_token()
    if kind == AccessSession.Kind.CLIENT:
        max_expires_at = (
            grant.invitation.expires_at + CLIENT_GRACE_PERIOD
            if grant.invitation.expires_at
            else now + CLIENT_SESSION_MAX_AGE
        )
        expires_at = min(now + CLIENT_SESSION_MAX_AGE, max_expires_at)
        idle_expires_at = min(now + CLIENT_SESSION_IDLE_AGE, expires_at)
    elif kind == AccessSession.Kind.GUEST:
        max_expires_at = _grant_expiry(grant.invitation, GUEST_SESSION_MAX_AGE)
        expires_at = min(now + GUEST_SESSION_MAX_AGE, max_expires_at)
        idle_expires_at = min(now + GUEST_SESSION_IDLE_AGE, expires_at)
    elif kind == AccessSession.Kind.PREVIEW:
        max_expires_at = _grant_expiry(grant.invitation, PREVIEW_SESSION_MAX_AGE)
        expires_at = min(now + PREVIEW_SESSION_MAX_AGE, max_expires_at)
        idle_expires_at = min(now + PREVIEW_SESSION_IDLE_AGE, expires_at)
    else:
        raise AccessDenied("Invalid access-session kind.")
    with transaction.atomic():
        active = list(
            AccessSession.objects.select_for_update()
            .filter(
                invitation=grant.invitation,
                kind=kind,
                guest=grant.guest if kind == AccessSession.Kind.GUEST else None,
                revoked_at__isnull=True,
            )
            .order_by("-last_seen_at")
        )
        for stale in active[MAX_ACTIVE_SESSIONS - 1 :]:
            stale.revoked_at = now
            stale.save(update_fields=["revoked_at", "updated_at"])
        session = AccessSession.objects.create(
            kind=kind,
            invitation=grant.invitation,
            guest=grant.guest if kind == AccessSession.Kind.GUEST else None,
            grant=grant,
            session_digest=digest,
            scopes=grant.scopes,
            expires_at=expires_at,
            idle_expires_at=idle_expires_at,
            last_seen_at=now,
            user_agent_digest=hashlib.sha256(user_agent.encode()).hexdigest() if user_agent else "",
        )
    return AuthenticatedAccess(session=session, raw_token=raw_token)


def access_from_raw_session(raw_token: str, *, kind: str) -> AuthenticatedAccess | None:
    digest = _session_digest(raw_token)
    if digest is None:
        return None
    now = timezone.now()
    session = (
        AccessSession.objects.select_related("invitation", "guest", "grant")
        .filter(session_digest=digest, kind=kind, revoked_at__isnull=True)
        .first()
    )
    if (
        session is None
        or session.expires_at <= now
        or session.idle_expires_at <= now
        or session.grant.revoked_at is not None
        or session.grant.expires_at <= now
        or session.invitation.archived_at is not None
    ):
        return None
    if kind == AccessSession.Kind.GUEST and (
        session.guest is None
        or session.guest.archived_at is not None
        or session.guest.anonymized_at is not None
    ):
        return None
    if session.invitation.expires_at and now >= session.invitation.expires_at:
        if kind in {AccessSession.Kind.GUEST, AccessSession.Kind.PREVIEW}:
            return None
        if now >= session.invitation.expires_at + CLIENT_GRACE_PERIOD:
            return None
    if now - session.last_seen_at >= timedelta(minutes=5):
        session.last_seen_at = now
        if kind == AccessSession.Kind.CLIENT:
            session.idle_expires_at = min(now + CLIENT_SESSION_IDLE_AGE, session.expires_at)
        elif kind == AccessSession.Kind.GUEST:
            session.idle_expires_at = min(now + GUEST_SESSION_IDLE_AGE, session.expires_at)
        else:
            session.idle_expires_at = min(
                now + PREVIEW_SESSION_IDLE_AGE,
                session.expires_at,
            )
        session.save(update_fields=["last_seen_at", "idle_expires_at", "updated_at"])
    return AuthenticatedAccess(session=session, raw_token=raw_token)


def access_from_request(request, *, kind: str) -> AuthenticatedAccess | None:
    if kind == AccessSession.Kind.CLIENT:
        cookie_name = getattr(
            settings,
            "CLIENT_ACCESS_COOKIE_NAME",
            CLIENT_SESSION_COOKIE,
        )
    elif kind == AccessSession.Kind.GUEST:
        cookie_name = getattr(
            settings,
            "GUEST_ACCESS_COOKIE_NAME",
            GUEST_SESSION_COOKIE,
        )
    elif kind == AccessSession.Kind.PREVIEW:
        cookie_name = getattr(
            settings,
            "PREVIEW_ACCESS_COOKIE_NAME",
            PREVIEW_SESSION_COOKIE,
        )
    else:
        return None
    return access_from_raw_session(request.COOKIES.get(cookie_name, ""), kind=kind)


def _check_client_pin(credential: ClientPortalCredential, pin: str) -> bool:
    now = timezone.now()
    if credential.locked_until and credential.locked_until > now:
        return False
    if check_password(pin, credential.pin_hash):
        credential.failed_attempts = 0
        credential.locked_until = None
        credential.save(update_fields=["failed_attempts", "locked_until", "updated_at"])
        return True
    credential.failed_attempts += 1
    if credential.failed_attempts >= PIN_LOCK_THRESHOLD:
        credential.locked_until = now + PIN_LOCK_AGE
    credential.save(update_fields=["failed_attempts", "locked_until", "updated_at"])
    if credential.failed_attempts >= PIN_REVOKE_THRESHOLD:
        AccessGrant.objects.filter(
            invitation=credential.invitation,
            purpose=AccessGrant.Purpose.CLIENT_PORTAL,
            revoked_at__isnull=True,
        ).update(revoked_at=now, updated_at=now)
    return False


def redeem_client_bootstrap(token: str, pin: str, *, user_agent: str = "") -> AuthenticatedAccess:
    access: AuthenticatedAccess | None = None
    pin_valid = False
    with transaction.atomic():
        grant = validate_grant_token(
            token,
            purposes=[AccessGrant.Purpose.CLIENT_PORTAL],
            consume=False,
        )
        credential = ClientPortalCredential.objects.select_for_update().get(
            invitation=grant.invitation
        )
        pin_valid = _check_client_pin(credential, pin)
        if pin_valid:
            now = timezone.now()
            grant.redeemed_at = now
            grant.expires_at = (
                grant.invitation.expires_at + CLIENT_GRACE_PERIOD
                if grant.invitation.expires_at
                else now + timedelta(days=365)
            )
            grant.save(update_fields=["redeemed_at", "expires_at", "updated_at"])
            access = create_access_session(
                grant,
                kind=AccessSession.Kind.CLIENT,
                user_agent=user_agent,
            )
    if not pin_valid or access is None:
        raise AccessDenied("Invalid client access.")
    return access


def login_client_portal(
    grant_id: UUID,
    pin: str,
    *,
    user_agent: str = "",
) -> AuthenticatedAccess:
    access: AuthenticatedAccess | None = None
    pin_valid = False
    with transaction.atomic():
        grant = (
            AccessGrant.objects.select_for_update()
            .select_related("invitation")
            .filter(
                id=grant_id,
                purpose=AccessGrant.Purpose.CLIENT_PORTAL,
                revoked_at__isnull=True,
            )
            .first()
        )
        now = timezone.now()
        if grant is None or grant.redeemed_at is None or grant.expires_at <= now:
            raise AccessDenied("Invalid client access.")
        credential = ClientPortalCredential.objects.select_for_update().get(
            invitation=grant.invitation
        )
        pin_valid = _check_client_pin(credential, pin)
        if pin_valid:
            grant.last_used_at = now
            grant.use_count += 1
            grant.save(update_fields=["last_used_at", "use_count", "updated_at"])
            access = create_access_session(
                grant,
                kind=AccessSession.Kind.CLIENT,
                user_agent=user_agent,
            )
    if not pin_valid or access is None:
        raise AccessDenied("Invalid client access.")
    return access


def change_client_pin(access: AuthenticatedAccess, current_pin: str, next_pin: str) -> None:
    if access.session.kind != AccessSession.Kind.CLIENT:
        raise AccessDenied("Invalid client access.")
    if len(next_pin) < 8 or len(next_pin) > 128:
        raise AccessDenied("PIN/passphrase must contain 8-128 characters.")
    denied_reason = ""
    with transaction.atomic():
        credential = ClientPortalCredential.objects.select_for_update().get(
            invitation=access.invitation
        )
        if not _check_client_pin(credential, current_pin):
            denied_reason = "Invalid client access."
        elif check_password(next_pin, credential.pin_hash):
            denied_reason = "New PIN/passphrase must be different."
        else:
            now = timezone.now()
            credential.pin_hash = make_password(next_pin)
            credential.must_change_pin = False
            credential.rotated_at = now
            credential.save(
                update_fields=["pin_hash", "must_change_pin", "rotated_at", "updated_at"]
            )
            AccessSession.objects.filter(
                invitation=access.invitation,
                kind=AccessSession.Kind.CLIENT,
                revoked_at__isnull=True,
            ).exclude(id=access.session.id).update(revoked_at=now, updated_at=now)
    if denied_reason:
        raise AccessDenied(denied_reason)


def redeem_guest_access(token: str, *, user_agent: str = "") -> AuthenticatedAccess:
    grant = validate_grant_token(
        token,
        purposes=[AccessGrant.Purpose.GUEST_INVITATION],
        consume=True,
    )
    if grant.guest is None or grant.guest.archived_at or grant.guest.anonymized_at:
        raise AccessDenied("Invalid guest access.")
    return create_access_session(
        grant,
        kind=AccessSession.Kind.GUEST,
        user_agent=user_agent,
    )


def redeem_preview_access(token: str, *, user_agent: str = "") -> AuthenticatedAccess:
    grant = validate_grant_token(
        token,
        purposes=[AccessGrant.Purpose.CLIENT_PREVIEW],
    )
    return create_access_session(
        grant,
        kind=AccessSession.Kind.PREVIEW,
        user_agent=user_agent,
    )


def revoke_access_session(access: AuthenticatedAccess) -> None:
    now = timezone.now()
    AccessSession.objects.filter(id=access.session.id, revoked_at__isnull=True).update(
        revoked_at=now,
        updated_at=now,
    )


def revoke_invitation_access(invitation: Invitation) -> None:
    now = timezone.now()
    AccessGrant.objects.filter(invitation=invitation, revoked_at__isnull=True).update(
        revoked_at=now,
        updated_at=now,
    )
    AccessSession.objects.filter(invitation=invitation, revoked_at__isnull=True).update(
        revoked_at=now,
        updated_at=now,
    )

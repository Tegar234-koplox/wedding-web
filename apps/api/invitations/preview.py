from django.core import signing

from invitations.models import Invitation

PREVIEW_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
PREVIEW_TOKEN_SALT = "niskala.invitation.preview"
WISHES_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365
WISHES_TOKEN_SALT = "niskala.invitation.wishes"


def preview_token_for(invitation: Invitation) -> str:
    payload = f"{invitation.id.hex}:{invitation.public_slug}"
    return signing.TimestampSigner(salt=PREVIEW_TOKEN_SALT).sign(payload)


def preview_token_is_valid(invitation: Invitation, token: str) -> bool:
    if not token:
        return False
    try:
        payload = signing.TimestampSigner(salt=PREVIEW_TOKEN_SALT).unsign(
            token,
            max_age=PREVIEW_TOKEN_MAX_AGE_SECONDS,
        )
    except signing.BadSignature:
        return False
    return payload == f"{invitation.id.hex}:{invitation.public_slug}"


def wishes_token_for(invitation: Invitation) -> str:
    payload = f"{invitation.id.hex}:{invitation.public_slug}:wishes"
    return signing.TimestampSigner(salt=WISHES_TOKEN_SALT).sign(payload)


def wishes_token_is_valid(invitation: Invitation, token: str) -> bool:
    if not token:
        return False
    try:
        payload = signing.TimestampSigner(salt=WISHES_TOKEN_SALT).unsign(
            token,
            max_age=WISHES_TOKEN_MAX_AGE_SECONDS,
        )
    except signing.BadSignature:
        return False
    return payload == f"{invitation.id.hex}:{invitation.public_slug}:wishes"

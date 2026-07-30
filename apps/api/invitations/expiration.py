from datetime import datetime, timedelta

from invitations.models import Invitation

PUBLICATION_LIFETIME_DAYS = {
    "essential": 90,
    "signature": 180,
    "couture": 365,
}
DEFAULT_PUBLICATION_LIFETIME_DAYS = PUBLICATION_LIFETIME_DAYS["essential"]


def publication_lifetime_days(invitation: Invitation) -> int:
    package_code = invitation.package.code if invitation.package_id else ""
    return PUBLICATION_LIFETIME_DAYS.get(package_code, DEFAULT_PUBLICATION_LIFETIME_DAYS)


def publication_expires_at(
    invitation: Invitation,
    *,
    published_at: datetime,
) -> datetime | None:
    if invitation.is_sample:
        return None
    return published_at + timedelta(days=publication_lifetime_days(invitation))

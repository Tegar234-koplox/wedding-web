from __future__ import annotations

from django.conf import settings
from django.db.models import F
from django.utils import timezone

from users.models import User

SESSION_ISSUED_AT_KEY = "staff_session_issued_at"
SESSION_LAST_SEEN_AT_KEY = "staff_session_last_seen_at"
SESSION_VERSION_KEY = "staff_session_version"


def now_timestamp() -> int:
    return int(timezone.now().timestamp())


def bind_staff_session(request, user: User, *, issued_at: int | None = None) -> None:
    """Bind the current browser session to the user's revocable security version."""
    timestamp = issued_at if issued_at is not None else now_timestamp()
    request.session[SESSION_ISSUED_AT_KEY] = timestamp
    request.session[SESSION_LAST_SEEN_AT_KEY] = timestamp
    request.session[SESSION_VERSION_KEY] = user.staff_session_version
    request.session.set_expiry(
        min(
            settings.SESSION_COOKIE_AGE,
            settings.STAFF_SESSION_ABSOLUTE_TTL_SECONDS,
        )
    )


def sync_current_staff_session_version(request, user: User) -> None:
    """Keep the current trusted session after revoking every other staff session."""
    request.session[SESSION_VERSION_KEY] = user.staff_session_version


def revoke_all_staff_sessions(user: User) -> int:
    """Invalidate every session bound to this staff account without scanning sessions."""
    User.objects.filter(pk=user.pk).update(
        staff_session_version=F("staff_session_version") + 1,
    )
    user.refresh_from_db(fields=["staff_session_version"])
    return user.staff_session_version

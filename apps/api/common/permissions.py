from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from common.mfa import mfa_enrolled


def require_recent_staff_mfa(request) -> None:
    """Require a recent second factor for sensitive staff mutations."""
    if not settings.STAFF_MFA_REQUIRED:
        return
    if not mfa_enrolled(request.user):
        raise PermissionDenied("MFA staff wajib diaktifkan sebelum melakukan aksi ini.")

    verified_at = request.session.get("staff_mfa_verified_at")
    if not isinstance(verified_at, int | float):
        raise PermissionDenied("Verifikasi ulang MFA diperlukan.")

    age_seconds = timezone.now().timestamp() - verified_at
    if age_seconds > settings.STAFF_MFA_REAUTH_TTL_SECONDS:
        raise PermissionDenied("Verifikasi ulang MFA diperlukan.")

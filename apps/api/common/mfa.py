from __future__ import annotations

import base64
import io
import secrets

import qrcode
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from django_otp.plugins.otp_totp.models import TOTPDevice

from users.models import StaffMFARecoveryCode

CHALLENGE_PREFIX = "staff-mfa-challenge"


def mfa_enrolled(user) -> bool:
    return TOTPDevice.objects.filter(user=user, confirmed=True).exists()


def create_login_challenge(user) -> str:
    token = secrets.token_urlsafe(32)
    cache.set(
        f"{CHALLENGE_PREFIX}:{token}",
        {"user_id": str(user.pk)},
        timeout=settings.STAFF_MFA_CHALLENGE_TTL_SECONDS,
    )
    return token


def challenge_user(token: str):
    payload = cache.get(f"{CHALLENGE_PREFIX}:{token}")
    if not isinstance(payload, dict) or not payload.get("user_id"):
        return None
    return get_user_model().objects.filter(pk=payload["user_id"]).first()


def consume_login_challenge(token: str) -> None:
    cache.delete(f"{CHALLENGE_PREFIX}:{token}")


def verify_second_factor(user, code: str) -> str | None:
    normalized = code.strip().replace(" ", "")
    device = TOTPDevice.objects.filter(user=user, confirmed=True).order_by("id").first()
    if device is not None and normalized.isdigit() and device.verify_token(normalized):
        return "totp"

    recovery_code = (
        StaffMFARecoveryCode.objects.filter(user=user, used_at__isnull=True)
        .order_by("created_at")
        .all()
    )
    for item in recovery_code:
        if check_password(normalized, item.code_hash):
            item.used_at = timezone.now()
            item.save(update_fields=["used_at"])
            return "recovery_code"
    return None


def enrollment_payload(user) -> dict[str, str]:
    TOTPDevice.objects.filter(user=user, confirmed=False).delete()
    device = TOTPDevice.objects.create(user=user, name="Niskala Staff", confirmed=False)
    image = qrcode.make(device.config_url)
    output = io.BytesIO()
    image.save(output, format="PNG")
    encoded_qr = base64.b64encode(output.getvalue()).decode("ascii")
    return {
        "otpauth_uri": device.config_url,
        "qr_data_url": f"data:image/png;base64,{encoded_qr}",
    }


@transaction.atomic
def confirm_enrollment(user, code: str) -> list[str] | None:
    device = TOTPDevice.objects.filter(user=user, confirmed=False).order_by("-id").first()
    if device is None or not code.strip().isdigit() or not device.verify_token(code.strip()):
        return None
    device.confirmed = True
    device.save(update_fields=["confirmed"])

    StaffMFARecoveryCode.objects.filter(user=user).delete()
    recovery_codes = [secrets.token_urlsafe(9) for _ in range(10)]
    StaffMFARecoveryCode.objects.bulk_create(
        [
            StaffMFARecoveryCode(user=user, code_hash=make_password(recovery_code))
            for recovery_code in recovery_codes
        ]
    )
    return recovery_codes


@transaction.atomic
def reset_mfa(user) -> None:
    TOTPDevice.objects.filter(user=user).delete()
    StaffMFARecoveryCode.objects.filter(user=user).delete()

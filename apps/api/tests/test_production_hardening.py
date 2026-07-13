from __future__ import annotations

import pytest
from axes.signals import user_locked_out
from django.contrib.sessions.middleware import SessionMiddleware
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, override_settings
from django.urls import reverse
from django.utils import timezone
from django_otp.oath import totp
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework.exceptions import PermissionDenied, ValidationError

from common.models import AuditEvent
from common.permissions import require_recent_staff_mfa
from common.throttles import NiskalaScopedRateThrottle
from invitations.views import _parse_guest_import_upload
from users.models import StaffMFARecoveryCode, User


def test_scoped_throttle_supports_multi_minute_windows():
    throttle = NiskalaScopedRateThrottle()

    assert throttle.parse_rate("5/5min") == (5, 300)
    assert throttle.parse_rate("30/min") == (30, 60)


@pytest.mark.django_db
def test_failed_staff_login_uses_generic_error_and_audit(client):
    response = client.post(
        reverse("api-staff-login"),
        {"username": "unknown", "password": "incorrect-password"},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Kredensial staff tidak valid."}
    event = AuditEvent.objects.get(action="staff.login_failed")
    assert event.resource_type == "staff_auth"
    assert "unknown" not in event.resource_reference


@pytest.mark.django_db
def test_staff_login_sets_absolute_session_and_writes_audit(client):
    User.objects.create_user(
        username="operations",
        email="operations@example.com",
        password="a-secure-password",
        role="staff",
        is_staff=True,
    )

    response = client.post(
        reverse("api-staff-login"),
        {"username": "operations", "password": "a-secure-password"},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert client.session.get_expiry_age() <= 43_200
    assert AuditEvent.objects.filter(action="staff.login_succeeded").exists()


@pytest.mark.django_db
def test_enrolled_staff_must_complete_totp_before_session_is_created(client):
    user = User.objects.create_user(
        username="mfa-staff",
        email="mfa-staff@example.com",
        password="a-secure-password",
        role="staff",
        is_staff=True,
    )
    device = TOTPDevice.objects.create(user=user, name="test", confirmed=True)

    password_response = client.post(
        reverse("api-staff-login"),
        {"username": user.username, "password": "a-secure-password"},
        content_type="application/json",
    )

    assert password_response.status_code == 202
    assert password_response.json()["mfa_required"] is True
    assert client.get(reverse("api-staff-session-me")).status_code == 403

    code = str(totp(device.bin_key, device.step, device.t0, device.digits, device.drift)).zfill(
        device.digits
    )
    mfa_response = client.post(
        reverse("api-staff-login-mfa"),
        {"challenge": password_response.json()["challenge"], "code": code},
        content_type="application/json",
    )

    assert mfa_response.status_code == 200
    assert mfa_response.json()["user"]["mfa_enrolled"] is True
    assert client.get(reverse("api-staff-session-me")).status_code == 200


@pytest.mark.django_db
def test_mfa_enrollment_returns_recovery_codes_once_and_stores_hashes(client):
    user = User.objects.create_user(
        username="enroll-staff",
        email="enroll-staff@example.com",
        password="a-secure-password",
        role="staff",
        is_staff=True,
    )
    client.force_login(user)

    enroll_response = client.post(
        reverse("api-staff-mfa-enroll"),
        {"password": "a-secure-password"},
        content_type="application/json",
    )
    device = TOTPDevice.objects.get(user=user, confirmed=False)
    code = str(totp(device.bin_key, device.step, device.t0, device.digits, device.drift)).zfill(
        device.digits
    )
    confirm_response = client.post(
        reverse("api-staff-mfa-confirm"),
        {"code": code},
        content_type="application/json",
    )

    assert enroll_response.status_code == 200
    assert enroll_response.json()["qr_data_url"].startswith("data:image/png;base64,")
    assert confirm_response.status_code == 200
    recovery_codes = confirm_response.json()["recovery_codes"]
    assert len(recovery_codes) == 10
    stored_codes = list(StaffMFARecoveryCode.objects.filter(user=user))
    assert len(stored_codes) == 10
    assert all(item.code_hash not in recovery_codes for item in stored_codes)


def test_guest_import_rejects_unknown_columns():
    upload = SimpleUploadedFile(
        "guests.csv",
        b"name,phone,private_field\nSyarif,+628123,secret\n",
        content_type="text/csv",
    )

    with pytest.raises(ValidationError, match="Kolom CSV tidak didukung"):
        _parse_guest_import_upload(upload)


def test_guest_import_rejects_files_larger_than_two_megabytes():
    upload = SimpleUploadedFile(
        "guests.csv",
        b"name,phone\n" + (b"a" * (2 * 1024 * 1024)),
        content_type="text/csv",
    )

    with pytest.raises(ValidationError, match="Ukuran CSV maksimal 2 MB"):
        _parse_guest_import_upload(upload)


@pytest.mark.django_db
@override_settings(STAFF_MFA_REQUIRED=True, STAFF_MFA_REAUTH_TTL_SECONDS=1800)
def test_sensitive_staff_action_requires_recent_mfa():
    user = User.objects.create_user(
        username="step-up-staff",
        password="a-secure-password",
        role="staff",
        is_staff=True,
    )
    TOTPDevice.objects.create(user=user, name="test", confirmed=True)
    request = RequestFactory().post("/api/v1/admin/orders/N001")
    SessionMiddleware(lambda _: None).process_request(request)
    request.session.save()
    request.user = user

    with pytest.raises(PermissionDenied, match="Verifikasi ulang MFA diperlukan"):
        require_recent_staff_mfa(request)

    request.session["staff_mfa_verified_at"] = int(timezone.now().timestamp())
    require_recent_staff_mfa(request)


@pytest.mark.django_db
def test_axes_lockout_is_audited_without_raw_identifier():
    request = RequestFactory().post("/api/v1/auth/login")
    request.request_id = "lockout-request"

    user_locked_out.send(
        sender=object(),
        request=request,
        username="locked-operator",
        ip_address="127.0.0.1",
    )

    event = AuditEvent.objects.get(action="staff.login_locked")
    assert "locked-operator" not in event.resource_reference
    assert event.metadata == {"request_id": "lockout-request"}

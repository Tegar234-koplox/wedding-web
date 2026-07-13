import hashlib

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.mfa import (
    challenge_user,
    confirm_enrollment,
    consume_login_challenge,
    create_login_challenge,
    enrollment_payload,
    mfa_enrolled,
    reset_mfa,
    verify_second_factor,
)
from common.models import AuditEvent
from common.serializers import StaffAuditEventSerializer, StaffSessionUserSerializer
from orders.permissions import IsStaffRole

STAFF_ROLE = "staff"
INVALID_STAFF_CREDENTIALS = "Kredensial staff tidak valid."
INVALID_MFA_CODE = "Kode verifikasi tidak valid atau kedaluwarsa."


def _auth_reference(identifier: str) -> str:
    digest = hashlib.sha256(identifier.strip().lower().encode("utf-8")).hexdigest()
    return f"staff-auth:{digest[:24]}"


def _audit_auth(request, *, action: str, identifier: str, actor=None, reason: str = "") -> None:
    AuditEvent.objects.create(
        actor=actor,
        action=action,
        resource_type="staff_auth",
        resource_reference=_auth_reference(identifier),
        metadata={
            "reason": reason,
            "request_id": getattr(request, "request_id", ""),
        },
    )


def _has_staff_access(user) -> bool:
    return bool(
        user
        and user.is_active
        and user.is_staff
        and (getattr(user, "is_superuser", False) or getattr(user, "role", "") == STAFF_ROLE)
    )


def _complete_staff_login(request, user, *, identifier: str, method: str = "password") -> None:
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    request.session.set_expiry(settings.SESSION_COOKIE_AGE)
    if method != "password":
        request.session["staff_mfa_verified_at"] = int(timezone.now().timestamp())
    _audit_auth(
        request,
        action="staff.login_succeeded",
        identifier=identifier,
        actor=user,
        reason=method,
    )


class StaffAuditEventListView(ListAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = StaffAuditEventSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = AuditEvent.objects.select_related("actor")
        resource_type = self.request.query_params.get("resource_type")
        resource_reference = self.request.query_params.get("resource_reference")
        if resource_type:
            queryset = queryset.filter(resource_type=resource_type)
        if resource_reference:
            queryset = queryset.filter(resource_reference=resource_reference)
        return queryset[:100]


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfTokenView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "csrf"

    def get(self, request) -> Response:
        return Response({"csrfToken": get_token(request)})


class StaffSessionMeView(APIView):
    permission_classes = [IsStaffRole]

    def get(self, request) -> Response:
        return Response({"user": StaffSessionUserSerializer(request.user).data})


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(ensure_csrf_cookie, name="dispatch")
class StaffLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "login"

    def post(self, request) -> Response:
        identifier = str(request.data.get("username") or request.data.get("email") or "").strip()
        password = str(request.data.get("password") or "")
        if not identifier or not password:
            _audit_auth(
                request,
                action="staff.login_failed",
                identifier=identifier,
                reason="invalid_credentials",
            )
            return Response(
                {"detail": INVALID_STAFF_CREDENTIALS},
                status=400,
            )

        username = identifier
        if "@" in identifier:
            user_model = get_user_model()
            username = (
                user_model.objects.filter(email__iexact=identifier)
                .values_list("username", flat=True)
                .first()
                or identifier
            )

        user = authenticate(request, username=username, password=password)
        if user is None:
            _audit_auth(
                request,
                action="staff.login_failed",
                identifier=identifier,
                reason="invalid_credentials",
            )
            return Response({"detail": INVALID_STAFF_CREDENTIALS}, status=400)

        if not _has_staff_access(user):
            _audit_auth(
                request,
                action="staff.login_failed",
                identifier=identifier,
                actor=user,
                reason="invalid_credentials",
            )
            return Response({"detail": INVALID_STAFF_CREDENTIALS}, status=400)

        enrolled = mfa_enrolled(user)
        if enrolled or settings.STAFF_MFA_REQUIRED:
            challenge = create_login_challenge(user)
            _audit_auth(
                request,
                action="staff.login_password_succeeded",
                identifier=identifier,
                actor=user,
            )
            return Response(
                {
                    "challenge": challenge,
                    "enrollment_required": not enrolled,
                    "mfa_required": True,
                },
                status=202,
            )

        _complete_staff_login(request, user, identifier=identifier)
        return Response({"user": StaffSessionUserSerializer(user).data})


@method_decorator(csrf_protect, name="dispatch")
class StaffMFALoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "mfa"

    def post(self, request) -> Response:
        challenge = str(request.data.get("challenge") or "").strip()
        code = str(request.data.get("code") or "").strip()
        user = challenge_user(challenge)
        if not challenge or not code or not _has_staff_access(user):
            return Response({"detail": INVALID_MFA_CODE}, status=400)

        method = verify_second_factor(user, code)
        if method is None:
            _audit_auth(
                request,
                action="staff.mfa_failed",
                identifier=user.get_username(),
                actor=user,
                reason="invalid_code",
            )
            return Response({"detail": INVALID_MFA_CODE}, status=400)

        consume_login_challenge(challenge)
        _complete_staff_login(
            request,
            user,
            identifier=user.get_username(),
            method=method,
        )
        if method == "recovery_code":
            _audit_auth(
                request,
                action="staff.mfa_recovery_code_used",
                identifier=user.get_username(),
                actor=user,
            )
        return Response({"user": StaffSessionUserSerializer(user).data})


class StaffMFAEnrollView(APIView):
    permission_classes = [IsStaffRole]
    throttle_scope = "mfa"

    def post(self, request) -> Response:
        password = str(request.data.get("password") or "")
        if not request.user.check_password(password):
            return Response({"detail": INVALID_STAFF_CREDENTIALS}, status=400)
        if mfa_enrolled(request.user):
            return Response({"detail": "MFA staff sudah aktif."}, status=400)
        payload = enrollment_payload(request.user)
        _audit_auth(
            request,
            action="staff.mfa_enrollment_started",
            identifier=request.user.get_username(),
            actor=request.user,
        )
        return Response(payload)


class StaffMFAConfirmView(APIView):
    permission_classes = [IsStaffRole]
    throttle_scope = "mfa"

    def post(self, request) -> Response:
        code = str(request.data.get("code") or "").strip()
        recovery_codes = confirm_enrollment(request.user, code)
        if recovery_codes is None:
            return Response({"detail": INVALID_MFA_CODE}, status=400)
        request.session["staff_mfa_verified_at"] = int(timezone.now().timestamp())
        _audit_auth(
            request,
            action="staff.mfa_enrolled",
            identifier=request.user.get_username(),
            actor=request.user,
        )
        return Response({"mfa_enrolled": True, "recovery_codes": recovery_codes})


class StaffMFAReauthView(APIView):
    permission_classes = [IsStaffRole]
    throttle_scope = "mfa"

    def post(self, request) -> Response:
        password = str(request.data.get("password") or "")
        code = str(request.data.get("code") or "").strip()
        method = verify_second_factor(request.user, code)
        if not request.user.check_password(password) or method is None:
            _audit_auth(
                request,
                action="staff.reauth_failed",
                identifier=request.user.get_username(),
                actor=request.user,
                reason="invalid_credentials",
            )
            return Response({"detail": INVALID_STAFF_CREDENTIALS}, status=400)
        request.session["staff_mfa_verified_at"] = int(timezone.now().timestamp())
        _audit_auth(
            request,
            action="staff.reauth_succeeded",
            identifier=request.user.get_username(),
            actor=request.user,
            reason=method,
        )
        return Response({"ok": True, "expires_in": settings.STAFF_MFA_REAUTH_TTL_SECONDS})


class StaffMFAResetView(APIView):
    permission_classes = [IsStaffRole]
    throttle_scope = "mfa"

    def post(self, request) -> Response:
        password = str(request.data.get("password") or "")
        code = str(request.data.get("code") or "").strip()
        if (
            not request.user.check_password(password)
            or verify_second_factor(request.user, code) is None
        ):
            return Response({"detail": INVALID_STAFF_CREDENTIALS}, status=400)
        user = request.user
        reset_mfa(user)
        _audit_auth(
            request,
            action="staff.mfa_reset",
            identifier=user.get_username(),
            actor=user,
        )
        logout(request)
        return Response({"ok": True})


class StaffLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request) -> Response:
        _audit_auth(
            request,
            action="staff.logout",
            identifier=request.user.get_username(),
            actor=request.user,
        )
        logout(request)
        return Response({"ok": True})

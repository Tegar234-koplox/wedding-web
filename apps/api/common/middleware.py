import logging
import re
import secrets
import time
import uuid
from collections.abc import Callable

from django.contrib.auth import logout
from django.db import connection
from django.http import HttpRequest, HttpResponse

from common.permissions import is_staff_user
from users.security import (
    SESSION_ISSUED_AT_KEY,
    SESSION_LAST_SEEN_AT_KEY,
    SESSION_VERSION_KEY,
    bind_staff_session,
    now_timestamp,
)

logger = logging.getLogger("wedding.request")
SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
SENSITIVE_PATH = re.compile(r"(/(?:api/v1/)?guest-management/)[^/]+")


def safe_log_path(path: str) -> str:
    return SENSITIVE_PATH.sub(r"\1<redacted>", path)


class BFFOriginAuthenticationMiddleware:
    """Require a server-only shared secret before dispatching API requests."""

    header_name = "X-Niskala-BFF-Secret"

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        from django.conf import settings

        expected = str(getattr(settings, "NISKALA_BFF_SHARED_SECRET", ""))
        environment = str(getattr(settings, "DEPLOYMENT_ENVIRONMENT", ""))
        protects_environment = environment == "production" or bool(expected)
        api_path = request.path_info == "/api/v1" or request.path_info.startswith("/api/v1/")
        if protects_environment and api_path:
            supplied = request.headers.get(self.header_name, "")
            if not expected or not secrets.compare_digest(
                supplied.encode("utf-8"),
                expected.encode("utf-8"),
            ):
                response = HttpResponse(status=404)
                response["Cache-Control"] = "private, no-store, max-age=0"
                response["Referrer-Policy"] = "no-referrer"
                return response
        return self.get_response(request)


class StaffSessionSecurityMiddleware:
    """Enforce idle, absolute, and account-version bounds on staff sessions."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        user = getattr(request, "user", None)
        if is_staff_user(user):
            rejection_reason = self._validate_or_initialize(request, user)
            if rejection_reason:
                user_id = str(user.pk)
                logout(request)
                logger.warning(
                    "staff.session_rejected",
                    extra={
                        "user_id": user_id,
                        "reason": rejection_reason,
                    },
                )
        return self.get_response(request)

    def _validate_or_initialize(self, request: HttpRequest, user) -> str:
        from django.conf import settings

        now = now_timestamp()
        issued_at = request.session.get(SESSION_ISSUED_AT_KEY)
        last_seen_at = request.session.get(SESSION_LAST_SEEN_AT_KEY)
        session_version = request.session.get(SESSION_VERSION_KEY)

        if not all(isinstance(value, int) for value in (issued_at, last_seen_at, session_version)):
            if getattr(settings, "DEPLOYMENT_ENVIRONMENT", "") == "production":
                return "missing_security_metadata"
            # Local/staging compatibility for sessions created before this middleware.
            bind_staff_session(request, user, issued_at=now)
            return ""

        if session_version != user.staff_session_version:
            return "security_version_changed"
        if now < issued_at or now < last_seen_at:
            return "invalid_session_timestamp"
        if now - issued_at > settings.STAFF_SESSION_ABSOLUTE_TTL_SECONDS:
            return "absolute_timeout"
        if now - last_seen_at > settings.STAFF_SESSION_IDLE_TTL_SECONDS:
            return "idle_timeout"

        if now - last_seen_at >= settings.STAFF_SESSION_TOUCH_INTERVAL_SECONDS:
            request.session[SESSION_LAST_SEEN_AT_KEY] = now
            remaining_absolute = settings.STAFF_SESSION_ABSOLUTE_TTL_SECONDS - (now - issued_at)
            request.session.set_expiry(
                max(
                    1,
                    min(
                        remaining_absolute,
                        settings.STAFF_SESSION_IDLE_TTL_SECONDS,
                    ),
                )
            )
        return ""


class RequestIdMiddleware:
    header_name = "X-Request-ID"

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        supplied_request_id = request.headers.get(self.header_name, "")
        request_id = (
            supplied_request_id
            if SAFE_REQUEST_ID.fullmatch(supplied_request_id)
            else str(uuid.uuid4())
        )
        request.request_id = request_id  # type: ignore[attr-defined]
        started_at = time.monotonic()
        response = self.get_response(request)
        response[self.header_name] = request_id
        logger.info(
            "request.completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": safe_log_path(request.path),
                "status_code": response.status_code,
                "duration_ms": round((time.monotonic() - started_at) * 1000, 2),
            },
        )
        return response


class DatabaseAccessContextMiddleware:
    """Expose the authenticated user context to PostgreSQL RLS policies."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        self._set_access_context(request)
        try:
            return self.get_response(request)
        finally:
            self._clear_access_context()

    def _set_access_context(self, request: HttpRequest) -> None:
        if connection.vendor != "postgresql":
            return
        user = getattr(request, "user", None)
        user_id = str(user.id) if getattr(user, "is_authenticated", False) else ""
        user_role = str(getattr(user, "role", "")) if user_id else ""
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('request.user_id', %s, false)", [user_id])
            cursor.execute("SELECT set_config('request.user_role', %s, false)", [user_role])

    def _clear_access_context(self) -> None:
        if connection.vendor != "postgresql":
            return
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('request.user_id', '', false)")
            cursor.execute("SELECT set_config('request.user_role', '', false)")

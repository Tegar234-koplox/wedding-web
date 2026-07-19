import logging
import re
import time
import uuid
from collections.abc import Callable

from django.db import connection
from django.http import HttpRequest, HttpResponse

logger = logging.getLogger("wedding.request")
SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
SENSITIVE_PATH = re.compile(r"(/(?:api/v1/)?(?:bespoke-reviews|guest-management)/)[^/]+")


def safe_log_path(path: str) -> str:
    return SENSITIVE_PATH.sub(r"\1<redacted>", path)


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

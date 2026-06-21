import logging
import re
import time
import uuid
from collections.abc import Callable

from django.http import HttpRequest, HttpResponse

logger = logging.getLogger("wedding.request")
SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


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
                "path": request.path,
                "status_code": response.status_code,
                "duration_ms": round((time.monotonic() - started_at) * 1000, 2),
            },
        )
        return response

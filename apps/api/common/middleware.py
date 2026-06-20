import uuid
from collections.abc import Callable

from django.http import HttpRequest, HttpResponse


class RequestIdMiddleware:
    header_name = "X-Request-ID"

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request_id = request.headers.get(self.header_name) or str(uuid.uuid4())
        request.request_id = request_id  # type: ignore[attr-defined]
        response = self.get_response(request)
        response[self.header_name] = request_id
        return response

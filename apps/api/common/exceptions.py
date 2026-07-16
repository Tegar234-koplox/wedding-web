import logging

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("wedding.api")


class ServiceUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "The requested service is temporarily unavailable."
    default_code = "service_unavailable"


def api_exception_handler(exc: Exception, context: dict[str, object]) -> Response | None:
    response = exception_handler(exc, context)
    request = context.get("request")
    request_id = getattr(request, "request_id", None)

    if response is None:
        logger.exception(
            "api.unhandled_exception",
            exc_info=(type(exc), exc, exc.__traceback__),
            extra={"request_id": request_id},
        )
        return Response(
            {
                "error": {
                    "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "code": "internal_error",
                    "message": "The request could not be completed.",
                    "request_id": request_id,
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    response.data = {
        "error": {
            "status": response.status_code,
            "code": getattr(exc, "default_code", "request_error"),
            "details": response.data,
            "request_id": request_id,
        }
    }
    return response

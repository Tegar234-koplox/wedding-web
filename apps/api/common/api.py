from rest_framework.exceptions import ValidationError

from common.validators import SUPPORTED_LOCALES


def request_locale(request: object) -> str:
    query_params = getattr(request, "query_params", {})
    locale = query_params.get("locale", "id")
    if locale not in SUPPORTED_LOCALES:
        raise ValidationError({"locale": "Supported locales are id and en."})
    return locale

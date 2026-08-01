from django.http import HttpResponse
from django.test import RequestFactory, override_settings

from common.middleware import BFFOriginAuthenticationMiddleware

STRONG_BFF_SECRET = "Bff-2026!Az3#Km7$Np2%Qr5&St8*Vx1"


def _middleware_response(path: str, supplied_secret: str | None = None):
    calls: list[str] = []

    def endpoint(request):
        calls.append(request.path_info)
        return HttpResponse("ok")

    headers = {"HTTP_X_NISKALA_BFF_SECRET": supplied_secret} if supplied_secret is not None else {}
    request = RequestFactory().get(path, **headers)
    response = BFFOriginAuthenticationMiddleware(endpoint)(request)
    return response, calls


@override_settings(
    DEPLOYMENT_ENVIRONMENT="production",
    NISKALA_BFF_SHARED_SECRET=STRONG_BFF_SECRET,
)
def test_production_api_accepts_only_the_matching_bff_secret():
    missing, missing_calls = _middleware_response("/api/v1/themes")
    wrong, wrong_calls = _middleware_response(
        "/api/v1/themes", "Wrong-2026!Az3#Km7$Np2%Qr5&St8*Vx1"
    )
    accepted, accepted_calls = _middleware_response("/api/v1/themes", STRONG_BFF_SECRET)

    assert missing.status_code == 404
    assert wrong.status_code == 404
    assert missing["Cache-Control"] == "private, no-store, max-age=0"
    assert missing.content == b""
    assert missing_calls == []
    assert wrong_calls == []
    assert accepted.status_code == 200
    assert accepted_calls == ["/api/v1/themes"]


@override_settings(
    DEPLOYMENT_ENVIRONMENT="production",
    NISKALA_BFF_SHARED_SECRET="",
)
def test_production_api_fails_closed_when_secret_is_missing_but_health_is_exempt():
    api_response, api_calls = _middleware_response("/api/v1")
    health_response, health_calls = _middleware_response("/health/ready")

    assert api_response.status_code == 404
    assert api_calls == []
    assert health_response.status_code == 200
    assert health_calls == ["/health/ready"]


@override_settings(
    DEPLOYMENT_ENVIRONMENT="staging",
    NISKALA_BFF_SHARED_SECRET=STRONG_BFF_SECRET,
)
def test_staging_is_protected_when_bff_secret_is_configured():
    rejected, rejected_calls = _middleware_response("/api/v1/packages")
    accepted, accepted_calls = _middleware_response("/api/v1/packages", STRONG_BFF_SECRET)

    assert rejected.status_code == 404
    assert rejected_calls == []
    assert accepted.status_code == 200
    assert accepted_calls == ["/api/v1/packages"]


@override_settings(
    DEPLOYMENT_ENVIRONMENT="development",
    NISKALA_BFF_SHARED_SECRET="",
)
def test_local_development_remains_available_without_origin_auth():
    response, calls = _middleware_response("/api/v1/themes")

    assert response.status_code == 200
    assert calls == ["/api/v1/themes"]

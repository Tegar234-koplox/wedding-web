from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET


@never_cache
@require_GET
def live(_: object) -> JsonResponse:
    return JsonResponse({"status": "ok"})


@never_cache
@require_GET
def ready(_: object) -> JsonResponse:
    checks: dict[str, str] = {}
    status = 200

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "unavailable"
        status = 503

    try:
        cache.set("healthcheck", "ok", timeout=10)
        checks["cache"] = "ok" if cache.get("healthcheck") == "ok" else "unavailable"
    except Exception:
        checks["cache"] = "unavailable"
        status = 503

    return JsonResponse(
        {"status": "ok" if status == 200 else "unavailable", "checks": checks},
        status=status,
    )

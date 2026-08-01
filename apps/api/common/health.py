from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET
from django_otp.plugins.otp_totp.models import TOTPDevice

from users.models import User


@never_cache
@require_GET
def live(_: object) -> JsonResponse:
    return JsonResponse(
        {
            "status": "ok",
            "environment": settings.DEPLOYMENT_ENVIRONMENT,
            "release": settings.DEPLOYMENT_RELEASE,
        }
    )


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

    if settings.DEPLOYMENT_ENVIRONMENT == "production" and settings.STAFF_MFA_REQUIRED:
        try:
            owner_ids = (
                User.objects.filter(
                    is_active=True,
                    is_staff=True,
                )
                .filter(
                    Q(is_superuser=True)
                    | Q(
                        role=User.Role.STAFF,
                        staff_role=User.StaffRole.OWNER,
                    )
                )
                .values("id")
            )
            has_enrolled_owner = TOTPDevice.objects.filter(
                user_id__in=owner_ids,
                confirmed=True,
            ).exists()
            checks["staff_mfa"] = "ok" if has_enrolled_owner else "unavailable"
            if not has_enrolled_owner:
                status = 503
        except Exception:
            checks["staff_mfa"] = "unavailable"
            status = 503

    return JsonResponse(
        {"status": "ok" if status == 200 else "unavailable", "checks": checks},
        status=status,
    )

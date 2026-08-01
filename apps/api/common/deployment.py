from __future__ import annotations

import os
from datetime import timedelta
from urllib.parse import urlparse

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime

_SECRET_PLACEHOLDER_MARKERS = (
    "local-development",
    "replace-with",
    "change-me",
    "changeme",
    "do-not-use",
    "placeholder",
    "example",
    "unsafe",
    "<",
    ">",
)

_PRODUCTION_TTL_LIMITS = {
    "STAFF_MFA_CHALLENGE_TTL_SECONDS": 600,
    "STAFF_MFA_REAUTH_TTL_SECONDS": 3_600,
    "STAFF_SESSION_ABSOLUTE_TTL_SECONDS": 43_200,
    "STAFF_SESSION_IDLE_TTL_SECONDS": 3_600,
    "STAFF_SESSION_TOUCH_INTERVAL_SECONDS": 300,
    "SESSION_COOKIE_AGE": 43_200,
}


def _secret_material_error(name: str, value: object, *, minimum_bytes: int = 32) -> str | None:
    secret = str(value or "")
    normalized = secret.lower()
    if len(secret.encode("utf-8")) < minimum_bytes:
        return f"{name} must contain at least {minimum_bytes} bytes"
    if not secret.isascii() or any(character.isspace() for character in secret):
        return f"{name} must be ASCII without whitespace"
    if any(marker in normalized for marker in _SECRET_PLACEHOLDER_MARKERS):
        return f"{name} must not use a placeholder value"
    if len(set(secret)) < 12:
        return f"{name} must have sufficient character diversity"
    return None


def bff_shared_secret_error(value: object) -> str | None:
    return _secret_material_error("NISKALA_BFF_SHARED_SECRET", value)


def _hostname(value: str) -> str:
    return (urlparse(value).hostname or "").lower()


def _expected(name: str, errors: list[str]) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        errors.append(f"{name} is required when DEPLOYMENT_ENVIRONMENT=staging")
    return value


def _production_expected(name: str, errors: list[str]) -> str:
    value = str(getattr(settings, name, "")).strip()
    if not value:
        errors.append(f"{name} is required when DEPLOYMENT_ENVIRONMENT=production")
    return value


def staging_configuration_errors() -> list[str]:
    if getattr(settings, "DEPLOYMENT_ENVIRONMENT", "") != "staging":
        return []

    errors: list[str] = []
    bff_error = bff_shared_secret_error(getattr(settings, "NISKALA_BFF_SHARED_SECRET", ""))
    if bff_error:
        errors.append(bff_error)
    frontend_origin = _expected("STAGING_EXPECTED_FRONTEND_ORIGIN", errors).rstrip("/")
    client_origin = _expected("STAGING_EXPECTED_CLIENT_ORIGIN", errors).rstrip("/")
    staff_origin = _expected("STAGING_EXPECTED_STAFF_ORIGIN", errors).rstrip("/")
    api_host = _expected("STAGING_EXPECTED_API_HOST", errors).lower()
    database_host = _expected("STAGING_EXPECTED_DATABASE_HOST", errors).lower()
    database_direct_host = _expected("STAGING_EXPECTED_DATABASE_DIRECT_HOST", errors).lower()
    database_name = _expected("STAGING_EXPECTED_DATABASE_NAME", errors)
    redis_host = _expected("STAGING_EXPECTED_REDIS_HOST", errors).lower()
    cloudinary_cloud = _expected("STAGING_EXPECTED_CLOUDINARY_CLOUD_NAME", errors)

    expected_origins = {
        frontend_origin,
        client_origin,
        staff_origin,
    } - {""}
    origin_settings = {
        "STAGING_EXPECTED_FRONTEND_ORIGIN": (
            frontend_origin,
            str(getattr(settings, "PUBLIC_SITE_URL", "")).rstrip("/"),
        ),
        "STAGING_EXPECTED_CLIENT_ORIGIN": (
            client_origin,
            str(getattr(settings, "CLIENT_SITE_URL", "")).rstrip("/"),
        ),
        "STAGING_EXPECTED_STAFF_ORIGIN": (
            staff_origin,
            str(getattr(settings, "STAFF_SITE_URL", "")).rstrip("/"),
        ),
    }
    for name, (expected_origin, configured_origin) in origin_settings.items():
        if not expected_origin:
            continue
        parsed_origin = urlparse(expected_origin)
        if (
            parsed_origin.scheme != "https"
            or not parsed_origin.hostname
            or parsed_origin.path not in {"", "/"}
            or parsed_origin.params
            or parsed_origin.query
            or parsed_origin.fragment
        ):
            errors.append(f"{name} must be an HTTPS origin")
        if configured_origin != expected_origin:
            setting_name = {
                "STAGING_EXPECTED_FRONTEND_ORIGIN": "PUBLIC_SITE_URL",
                "STAGING_EXPECTED_CLIENT_ORIGIN": "CLIENT_SITE_URL",
                "STAGING_EXPECTED_STAFF_ORIGIN": "STAFF_SITE_URL",
            }[name]
            errors.append(f"{setting_name} does not match {name}")
    if len(expected_origins) == 3 and len({_hostname(item) for item in expected_origins}) != 3:
        errors.append("Staging public, client, and staff origins must use separate hosts")
    if expected_origins and set(settings.CORS_ALLOWED_ORIGINS) != expected_origins:
        errors.append("DJANGO_CORS_ALLOWED_ORIGINS must contain only the staging trust zones")
    if expected_origins and set(settings.CSRF_TRUSTED_ORIGINS) != expected_origins:
        errors.append("DJANGO_CSRF_TRUSTED_ORIGINS must contain only the staging trust zones")

    allowed_hosts = {host.lower() for host in settings.ALLOWED_HOSTS}
    permitted_hosts = {api_host, "healthcheck.railway.app"} if api_host else set()
    if api_host and api_host not in allowed_hosts:
        errors.append("DJANGO_ALLOWED_HOSTS does not include the expected staging API host")
    if "*" in allowed_hosts or allowed_hosts - permitted_hosts:
        errors.append("DJANGO_ALLOWED_HOSTS contains a host outside the staging allowlist")

    database = settings.DATABASES["default"]
    release_uses_direct_database = (
        os.environ.get("NISKALA_RELEASE_DATABASE_MODE", "").strip().lower() == "direct"
    )
    expected_effective_database_host = (
        database_direct_host if release_uses_direct_database else database_host
    )
    if (
        expected_effective_database_host
        and str(database.get("HOST", "")).lower() != expected_effective_database_host
    ):
        expected_host_name = (
            "STAGING_EXPECTED_DATABASE_DIRECT_HOST"
            if release_uses_direct_database
            else "STAGING_EXPECTED_DATABASE_HOST"
        )
        errors.append(f"DATABASE_URL host does not match {expected_host_name}")
    if database_name and str(database.get("NAME", "")) != database_name:
        errors.append("DATABASE_URL name does not match STAGING_EXPECTED_DATABASE_NAME")
    direct_database = urlparse(os.environ.get("DATABASE_DIRECT_URL", ""))
    if database_direct_host and (direct_database.hostname or "").lower() != database_direct_host:
        errors.append(
            "DATABASE_DIRECT_URL host does not match STAGING_EXPECTED_DATABASE_DIRECT_HOST"
        )
    if database_name and direct_database.path.lstrip("/") != database_name:
        errors.append("DATABASE_DIRECT_URL name does not match STAGING_EXPECTED_DATABASE_NAME")

    redis_urls = {
        "REDIS_URL": settings.CACHES["default"]["LOCATION"],
        "CELERY_BROKER_URL": settings.CELERY_BROKER_URL,
        "CELERY_RESULT_BACKEND": settings.CELERY_RESULT_BACKEND,
    }
    for name, value in redis_urls.items():
        if redis_host and _hostname(value) != redis_host:
            errors.append(f"{name} host does not match STAGING_EXPECTED_REDIS_HOST")

    if cloudinary_cloud and settings.CLOUDINARY_CLOUD_NAME != cloudinary_cloud:
        errors.append("CLOUDINARY_CLOUD_NAME does not match STAGING_EXPECTED_CLOUDINARY_CLOUD_NAME")
    if settings.SENTRY_ENVIRONMENT != "staging":
        errors.append("SENTRY_ENVIRONMENT must be staging")
    if settings.SESSION_COOKIE_DOMAIN is not None:
        errors.append("DJANGO_SESSION_COOKIE_DOMAIN must be blank for host-only cookies")
    if settings.CSRF_COOKIE_DOMAIN is not None:
        errors.append("DJANGO_CSRF_COOKIE_DOMAIN must be blank for host-only cookies")
    return errors


def production_configuration_errors() -> list[str]:
    if getattr(settings, "DEPLOYMENT_ENVIRONMENT", "") != "production":
        return []

    errors: list[str] = []
    bff_error = bff_shared_secret_error(getattr(settings, "NISKALA_BFF_SHARED_SECRET", ""))
    if bff_error:
        errors.append(bff_error)
    if "common.middleware.BFFOriginAuthenticationMiddleware" not in getattr(
        settings, "MIDDLEWARE", []
    ):
        errors.append("BFF origin-auth middleware must be enabled in production")
    if getattr(settings, "DEBUG", True):
        errors.append("DEBUG must be false in production")
    secret_key = str(getattr(settings, "SECRET_KEY", ""))
    if _secret_material_error("DJANGO_SECRET_KEY", secret_key, minimum_bytes=50):
        errors.append("DJANGO_SECRET_KEY must be a production secret")
    if not getattr(settings, "SECURE_SSL_REDIRECT", False):
        errors.append("DJANGO_SECURE_SSL_REDIRECT must be true in production")
    if getattr(settings, "SECURE_PROXY_SSL_HEADER", None) != (
        "HTTP_X_FORWARDED_PROTO",
        "https",
    ):
        errors.append("SECURE_PROXY_SSL_HEADER must trust only X-Forwarded-Proto=https")
    if int(getattr(settings, "SECURE_HSTS_SECONDS", 0)) < 31_536_000:
        errors.append("SECURE_HSTS_SECONDS must be at least one year in production")

    cookie_contract = {
        "SESSION_COOKIE_NAME": "__Host-niskala_staff",
        "CSRF_COOKIE_NAME": "__Host-niskala_csrf",
        "CLIENT_ACCESS_COOKIE_NAME": "__Host-niskala_client",
        "GUEST_ACCESS_COOKIE_NAME": "__Host-niskala_guest",
        "PREVIEW_ACCESS_COOKIE_NAME": "__Host-niskala_preview",
    }
    for setting_name, expected_name in cookie_contract.items():
        if getattr(settings, setting_name, "") != expected_name:
            errors.append(f"{setting_name} must be {expected_name} in production")
    if not getattr(settings, "SESSION_COOKIE_SECURE", False):
        errors.append("SESSION_COOKIE_SECURE must be true in production")
    if not getattr(settings, "CSRF_COOKIE_SECURE", False):
        errors.append("CSRF_COOKIE_SECURE must be true in production")
    if getattr(settings, "SESSION_COOKIE_DOMAIN", None) is not None:
        errors.append("DJANGO_SESSION_COOKIE_DOMAIN must be blank in production")
    if getattr(settings, "CSRF_COOKIE_DOMAIN", None) is not None:
        errors.append("DJANGO_CSRF_COOKIE_DOMAIN must be blank in production")
    if getattr(settings, "SESSION_COOKIE_PATH", "") != "/":
        errors.append("SESSION_COOKIE_PATH must be / for __Host cookies")
    if getattr(settings, "CSRF_COOKIE_PATH", "") != "/":
        errors.append("CSRF_COOKIE_PATH must be / for __Host cookies")
    if getattr(settings, "SESSION_COOKIE_SAMESITE", "") != "Strict":
        errors.append("SESSION_COOKIE_SAMESITE must be Strict in production")
    if getattr(settings, "CSRF_COOKIE_SAMESITE", "") != "Strict":
        errors.append("CSRF_COOKIE_SAMESITE must be Strict in production")
    if not getattr(settings, "STAFF_MFA_REQUIRED", False):
        errors.append("STAFF_MFA_REQUIRED must be true in production")

    allowed_hosts = {
        str(host).strip().lower()
        for host in getattr(settings, "ALLOWED_HOSTS", [])
        if str(host).strip()
    }
    allowed_hosts_are_explicit = bool(allowed_hosts) and not any(
        "*" in host or host.startswith(".") for host in allowed_hosts
    )
    if not allowed_hosts:
        errors.append("DJANGO_ALLOWED_HOSTS must contain an explicit production allowlist")
    elif not allowed_hosts_are_explicit:
        errors.append("DJANGO_ALLOWED_HOSTS must not contain wildcard hosts in production")

    expected_api_host = str(getattr(settings, "PRODUCTION_EXPECTED_API_HOST", "")).strip().lower()
    if (
        not expected_api_host
        or ":" in expected_api_host
        or "/" in expected_api_host
        or "*" in expected_api_host
        or expected_api_host.startswith(".")
    ):
        errors.append("PRODUCTION_EXPECTED_API_HOST must be an explicit DNS hostname")
    elif allowed_hosts_are_explicit:
        permitted_hosts = {expected_api_host, "healthcheck.railway.app"}
        if expected_api_host not in allowed_hosts:
            errors.append("DJANGO_ALLOWED_HOSTS does not include PRODUCTION_EXPECTED_API_HOST")
        if allowed_hosts - permitted_hosts:
            errors.append("DJANGO_ALLOWED_HOSTS contains a host outside the production allowlist")

    keys = getattr(settings, "CAPABILITY_KEYS", {})
    primary_key_id = str(getattr(settings, "CAPABILITY_PRIMARY_KEY_ID", "")).strip()
    capability_values: list[str] = []
    if not isinstance(keys, dict) or not keys:
        errors.append("CAPABILITY_KEYS_JSON must contain at least one capability key")
    elif primary_key_id not in keys:
        errors.append("CAPABILITY_PRIMARY_KEY_ID must identify a configured capability key")
    elif any(len(str(value).encode()) < 32 for value in keys.values()):
        errors.append("Every capability key must contain at least 32 bytes")
    else:
        capability_values = [str(value) for value in keys.values()]
        normalized_keys = [value.lower() for value in capability_values]
        if any(
            not value.isascii() or any(character.isspace() for character in value)
            for value in capability_values
        ):
            errors.append("Capability keys must be ASCII without whitespace")
        elif any(
            marker in value for value in normalized_keys for marker in _SECRET_PLACEHOLDER_MARKERS
        ):
            errors.append("Placeholder capability keys must not be used in production")
        elif any(len(set(value)) < 12 for value in normalized_keys):
            errors.append("Capability keys must have sufficient character diversity")
        if len(set(capability_values)) != len(capability_values):
            errors.append("Capability keys must contain unique secret material")

    bff_secret = str(getattr(settings, "NISKALA_BFF_SHARED_SECRET", ""))
    secret_material = [secret_key, bff_secret, *capability_values]
    if all(secret_material) and len(set(secret_material)) != len(secret_material):
        errors.append(
            "DJANGO_SECRET_KEY, NISKALA_BFF_SHARED_SECRET, and capability keys must be distinct"
        )

    public_site = urlparse(str(getattr(settings, "PUBLIC_SITE_URL", "")))
    client_site = urlparse(str(getattr(settings, "CLIENT_SITE_URL", "")))
    staff_site = urlparse(str(getattr(settings, "STAFF_SITE_URL", "")))
    expected_origins = {
        "PUBLIC_SITE_URL": str(getattr(settings, "PRODUCTION_EXPECTED_PUBLIC_ORIGIN", "")).rstrip(
            "/"
        ),
        "CLIENT_SITE_URL": str(getattr(settings, "PRODUCTION_EXPECTED_CLIENT_ORIGIN", "")).rstrip(
            "/"
        ),
        "STAFF_SITE_URL": str(getattr(settings, "PRODUCTION_EXPECTED_STAFF_ORIGIN", "")).rstrip(
            "/"
        ),
    }
    configured_origins = {
        "PUBLIC_SITE_URL": str(getattr(settings, "PUBLIC_SITE_URL", "")).rstrip("/"),
        "CLIENT_SITE_URL": str(getattr(settings, "CLIENT_SITE_URL", "")).rstrip("/"),
        "STAFF_SITE_URL": str(getattr(settings, "STAFF_SITE_URL", "")).rstrip("/"),
    }
    for setting_name, expected_origin in expected_origins.items():
        parsed_expected = urlparse(expected_origin)
        if (
            parsed_expected.scheme != "https"
            or not parsed_expected.hostname
            or parsed_expected.path not in {"", "/"}
            or parsed_expected.params
            or parsed_expected.query
            or parsed_expected.fragment
        ):
            errors.append(
                f"PRODUCTION_EXPECTED_{setting_name.removesuffix('_SITE_URL')}_ORIGIN "
                "must be an explicit HTTPS origin"
            )
            continue
        if configured_origins[setting_name] != expected_origin:
            errors.append(f"{setting_name} does not match its PRODUCTION_EXPECTED origin")
    if (
        public_site.scheme != "https"
        or not public_site.hostname
        or public_site.path not in {"", "/"}
        or public_site.params
        or public_site.query
        or public_site.fragment
    ):
        errors.append("PUBLIC_SITE_URL must be an explicit HTTPS production origin")
    if (
        client_site.scheme != "https"
        or not client_site.hostname
        or client_site.path not in {"", "/"}
        or client_site.params
        or client_site.query
        or client_site.fragment
    ):
        errors.append("CLIENT_SITE_URL must be an explicit HTTPS production origin")
    if (
        staff_site.scheme != "https"
        or not staff_site.hostname
        or staff_site.path not in {"", "/"}
        or staff_site.params
        or staff_site.query
        or staff_site.fragment
    ):
        errors.append("STAFF_SITE_URL must be an explicit HTTPS production origin")
    site_hosts = [
        host for host in (public_site.hostname, client_site.hostname, staff_site.hostname) if host
    ]
    if len(site_hosts) == 3 and len(set(site_hosts)) != 3:
        errors.append(
            "PUBLIC_SITE_URL, CLIENT_SITE_URL, and STAFF_SITE_URL must use separate hosts"
        )

    required_trusted_origins = {origin for origin in expected_origins.values() if origin}
    configured_cors_origins = {
        str(origin).rstrip("/") for origin in getattr(settings, "CORS_ALLOWED_ORIGINS", [])
    }
    configured_csrf_origins = {
        str(origin).rstrip("/") for origin in getattr(settings, "CSRF_TRUSTED_ORIGINS", [])
    }
    if len(required_trusted_origins) == 3 and configured_cors_origins != required_trusted_origins:
        errors.append(
            "DJANGO_CORS_ALLOWED_ORIGINS must contain only public, client, and staff origins"
        )
    if len(required_trusted_origins) == 3 and configured_csrf_origins != required_trusted_origins:
        errors.append(
            "DJANGO_CSRF_TRUSTED_ORIGINS must contain only public, client, and staff origins"
        )

    database_host = _production_expected("PRODUCTION_EXPECTED_DATABASE_HOST", errors).lower()
    database_direct_host = _production_expected(
        "PRODUCTION_EXPECTED_DATABASE_DIRECT_HOST", errors
    ).lower()
    database_name = _production_expected("PRODUCTION_EXPECTED_DATABASE_NAME", errors)
    redis_host = _production_expected("PRODUCTION_EXPECTED_REDIS_HOST", errors).lower()
    cloudinary_cloud = _production_expected("PRODUCTION_EXPECTED_CLOUDINARY_CLOUD_NAME", errors)

    database = getattr(settings, "DATABASES", {}).get("default", {})
    if database.get("ENGINE") != "django.db.backends.postgresql":
        errors.append("Production DATABASE_URL must use PostgreSQL")
    release_uses_direct_database = (
        os.environ.get("NISKALA_RELEASE_DATABASE_MODE", "").strip().lower() == "direct"
    )
    expected_effective_database_host = (
        database_direct_host if release_uses_direct_database else database_host
    )
    if (
        expected_effective_database_host
        and str(database.get("HOST", "")).lower() != expected_effective_database_host
    ):
        expected_host_name = (
            "PRODUCTION_EXPECTED_DATABASE_DIRECT_HOST"
            if release_uses_direct_database
            else "PRODUCTION_EXPECTED_DATABASE_HOST"
        )
        errors.append(f"DATABASE_URL host does not match {expected_host_name}")
    if database_name and str(database.get("NAME", "")) != database_name:
        errors.append("DATABASE_URL name does not match PRODUCTION_EXPECTED_DATABASE_NAME")

    direct_database = urlparse(
        str(
            getattr(settings, "DATABASE_DIRECT_URL", "")
            or os.environ.get("DATABASE_DIRECT_URL", "")
        )
    )
    if database_direct_host and (direct_database.hostname or "").lower() != database_direct_host:
        errors.append(
            "DATABASE_DIRECT_URL host does not match PRODUCTION_EXPECTED_DATABASE_DIRECT_HOST"
        )
    if database_name and direct_database.path.lstrip("/") != database_name:
        errors.append("DATABASE_DIRECT_URL name does not match PRODUCTION_EXPECTED_DATABASE_NAME")

    redis_urls = {
        "REDIS_URL": getattr(settings, "CACHES", {}).get("default", {}).get("LOCATION", ""),
        "CELERY_BROKER_URL": getattr(settings, "CELERY_BROKER_URL", ""),
        "CELERY_RESULT_BACKEND": getattr(settings, "CELERY_RESULT_BACKEND", ""),
    }
    for name, value in redis_urls.items():
        if redis_host and _hostname(str(value)) != redis_host:
            errors.append(f"{name} host does not match PRODUCTION_EXPECTED_REDIS_HOST")

    if cloudinary_cloud and getattr(settings, "CLOUDINARY_CLOUD_NAME", "") != cloudinary_cloud:
        errors.append(
            "CLOUDINARY_CLOUD_NAME does not match PRODUCTION_EXPECTED_CLOUDINARY_CLOUD_NAME"
        )
    if not str(getattr(settings, "CLOUDINARY_API_KEY", "")).strip():
        errors.append("CLOUDINARY_API_KEY is required in production")
    if not str(getattr(settings, "CLOUDINARY_API_SECRET", "")).strip():
        errors.append("CLOUDINARY_API_SECRET is required in production")
    if getattr(settings, "SENTRY_ENVIRONMENT", "") != "production":
        errors.append("SENTRY_ENVIRONMENT must be production")
    if not str(getattr(settings, "SENTRY_DSN", "")).strip():
        errors.append("SENTRY_DSN is required in production")

    ttl_values: dict[str, int] = {}
    for setting_name, maximum in _PRODUCTION_TTL_LIMITS.items():
        try:
            value = int(getattr(settings, setting_name, 0))
        except (TypeError, ValueError):
            value = 0
        if value <= 0 or value > maximum:
            errors.append(f"{setting_name} must be between 1 and {maximum} seconds in production")
        else:
            ttl_values[setting_name] = value

    absolute_ttl = ttl_values.get("STAFF_SESSION_ABSOLUTE_TTL_SECONDS")
    idle_ttl = ttl_values.get("STAFF_SESSION_IDLE_TTL_SECONDS")
    touch_interval = ttl_values.get("STAFF_SESSION_TOUCH_INTERVAL_SECONDS")
    reauth_ttl = ttl_values.get("STAFF_MFA_REAUTH_TTL_SECONDS")
    cookie_age = ttl_values.get("SESSION_COOKIE_AGE")
    if absolute_ttl and idle_ttl and idle_ttl > absolute_ttl:
        errors.append("STAFF_SESSION_IDLE_TTL_SECONDS must not exceed the absolute session TTL")
    if idle_ttl and touch_interval and touch_interval > idle_ttl:
        errors.append("STAFF_SESSION_TOUCH_INTERVAL_SECONDS must not exceed the idle session TTL")
    if idle_ttl and reauth_ttl and reauth_ttl > idle_ttl:
        errors.append("STAFF_MFA_REAUTH_TTL_SECONDS must not exceed the idle session TTL")
    if absolute_ttl and cookie_age and cookie_age > absolute_ttl:
        errors.append("DJANGO_SESSION_COOKIE_AGE must not exceed the absolute staff session TTL")

    if getattr(settings, "LEGACY_INVITATION_LINKS_ENABLED", False):
        cutoff_raw = str(getattr(settings, "LEGACY_INVITATION_LINK_CUTOFF", "")).strip()
        cutoff = parse_datetime(cutoff_raw)
        if cutoff is None:
            errors.append(
                "LEGACY_INVITATION_LINK_CUTOFF must be configured while legacy links are enabled"
            )
        else:
            if timezone.is_naive(cutoff):
                cutoff = timezone.make_aware(cutoff)
            if cutoff > timezone.now() + timedelta(days=14):
                errors.append("Legacy invitation-link grace must not exceed 14 days")

    return errors

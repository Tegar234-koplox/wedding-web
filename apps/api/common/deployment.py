from __future__ import annotations

import os
from urllib.parse import urlparse

from django.conf import settings


def _hostname(value: str) -> str:
    return (urlparse(value).hostname or "").lower()


def _expected(name: str, errors: list[str]) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        errors.append(f"{name} is required when DEPLOYMENT_ENVIRONMENT=staging")
    return value


def staging_configuration_errors() -> list[str]:
    if getattr(settings, "DEPLOYMENT_ENVIRONMENT", "") != "staging":
        return []

    errors: list[str] = []
    frontend_origin = _expected("STAGING_EXPECTED_FRONTEND_ORIGIN", errors).rstrip("/")
    api_host = _expected("STAGING_EXPECTED_API_HOST", errors).lower()
    database_host = _expected("STAGING_EXPECTED_DATABASE_HOST", errors).lower()
    database_direct_host = _expected("STAGING_EXPECTED_DATABASE_DIRECT_HOST", errors).lower()
    database_name = _expected("STAGING_EXPECTED_DATABASE_NAME", errors)
    redis_host = _expected("STAGING_EXPECTED_REDIS_HOST", errors).lower()
    cloudinary_cloud = _expected("STAGING_EXPECTED_CLOUDINARY_CLOUD_NAME", errors)

    if frontend_origin:
        parsed_frontend = urlparse(frontend_origin)
        if parsed_frontend.scheme != "https" or not parsed_frontend.hostname:
            errors.append("STAGING_EXPECTED_FRONTEND_ORIGIN must be an HTTPS origin")
        if set(settings.CORS_ALLOWED_ORIGINS) != {frontend_origin}:
            errors.append("DJANGO_CORS_ALLOWED_ORIGINS must contain only the staging frontend")
        if set(settings.CSRF_TRUSTED_ORIGINS) != {frontend_origin}:
            errors.append("DJANGO_CSRF_TRUSTED_ORIGINS must contain only the staging frontend")

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
    if settings.MIDTRANS_IS_PRODUCTION:
        errors.append("MIDTRANS_IS_PRODUCTION must be false in staging")

    return errors

from unittest.mock import patch

import pytest
from django.contrib.auth.hashers import is_password_usable
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from common.deployment import (
    production_configuration_errors,
    staging_configuration_errors,
)
from config.release import prepare_release_environment
from invitations.models import Guest, Invitation
from orders.models import Order

STRONG_CAPABILITY_KEY = "Cap-2026!Az3#Km7$Np2%Qr5&St8*Vx1"
PRODUCTION_RUNTIME_SECURITY = {
    "NISKALA_BFF_SHARED_SECRET": "Bff-2026!Az3#Km7$Np2%Qr5&St8*Vx1",
    "SECRET_KEY": "Django-2026!Bx4$Ln8%Qs3&Uw7*Yz2#Ce6@Hg9^Jk5+Mp1!Rt8",
    "SECURE_SSL_REDIRECT": True,
    "SECURE_PROXY_SSL_HEADER": ("HTTP_X_FORWARDED_PROTO", "https"),
    "SECURE_HSTS_SECONDS": 31_536_000,
    "SESSION_COOKIE_NAME": "__Host-niskala_staff",
    "CSRF_COOKIE_NAME": "__Host-niskala_csrf",
    "CLIENT_ACCESS_COOKIE_NAME": "__Host-niskala_client",
    "GUEST_ACCESS_COOKIE_NAME": "__Host-niskala_guest",
    "PREVIEW_ACCESS_COOKIE_NAME": "__Host-niskala_preview",
    "SESSION_COOKIE_SECURE": True,
    "CSRF_COOKIE_SECURE": True,
    "SESSION_COOKIE_DOMAIN": None,
    "CSRF_COOKIE_DOMAIN": None,
    "SESSION_COOKIE_PATH": "/",
    "CSRF_COOKIE_PATH": "/",
    "SESSION_COOKIE_SAMESITE": "Strict",
    "CSRF_COOKIE_SAMESITE": "Strict",
    "PRODUCTION_EXPECTED_PUBLIC_ORIGIN": "https://niskalastudio.site",
    "PRODUCTION_EXPECTED_CLIENT_ORIGIN": "https://client.niskalastudio.site",
    "PRODUCTION_EXPECTED_STAFF_ORIGIN": "https://staff.niskalastudio.site",
    "PRODUCTION_EXPECTED_API_HOST": "api.niskalastudio.site",
    "PRODUCTION_EXPECTED_DATABASE_HOST": "prod-db.internal",
    "PRODUCTION_EXPECTED_DATABASE_DIRECT_HOST": "prod-db-direct.internal",
    "PRODUCTION_EXPECTED_DATABASE_NAME": "niskala_prod",
    "PRODUCTION_EXPECTED_REDIS_HOST": "prod-redis.internal",
    "PRODUCTION_EXPECTED_CLOUDINARY_CLOUD_NAME": "niskala-production",
    "DATABASES": {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "HOST": "prod-db.internal",
            "NAME": "niskala_prod",
        }
    },
    "DATABASE_DIRECT_URL": ("postgresql://niskala:test@prod-db-direct.internal:5432/niskala_prod"),
    "CACHES": {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": "redis://prod-redis.internal:6379/0",
        }
    },
    "CELERY_BROKER_URL": "redis://prod-redis.internal:6379/1",
    "CELERY_RESULT_BACKEND": "redis://prod-redis.internal:6379/2",
    "CLOUDINARY_CLOUD_NAME": "niskala-production",
    "CLOUDINARY_API_KEY": "production-cloudinary-key",
    "CLOUDINARY_API_SECRET": "production-cloudinary-secret",
    "SENTRY_DSN": "https://public@example.ingest.sentry.io/1",
    "SENTRY_ENVIRONMENT": "production",
    "STAFF_MFA_CHALLENGE_TTL_SECONDS": 300,
    "STAFF_MFA_REAUTH_TTL_SECONDS": 1_800,
    "STAFF_SESSION_ABSOLUTE_TTL_SECONDS": 28_800,
    "STAFF_SESSION_IDLE_TTL_SECONDS": 1_800,
    "STAFF_SESSION_TOUCH_INTERVAL_SECONDS": 60,
    "SESSION_COOKIE_AGE": 28_800,
}


def test_release_environment_uses_direct_database_url():
    environment = {
        "DATABASE_URL": "postgresql://pooled",
        "DATABASE_DIRECT_URL": "postgresql://direct",
    }

    prepare_release_environment(environment)

    assert environment["DATABASE_URL"] == "postgresql://direct"
    assert environment["NISKALA_RELEASE_DATABASE_MODE"] == "direct"
    assert environment["DJANGO_SETTINGS_MODULE"] == "config.settings.production"


def test_release_environment_requires_direct_database_url():
    with pytest.raises(RuntimeError, match="DATABASE_DIRECT_URL"):
        prepare_release_environment({})


@override_settings(
    DEPLOYMENT_ENVIRONMENT="production",
    STAFF_MFA_REQUIRED=True,
    ALLOWED_HOSTS=["api.niskalastudio.site", "healthcheck.railway.app"],
    CAPABILITY_KEYS={"prod-2026": STRONG_CAPABILITY_KEY},
    CAPABILITY_PRIMARY_KEY_ID="prod-2026",
    PUBLIC_SITE_URL="https://niskalastudio.site",
    CLIENT_SITE_URL="https://client.niskalastudio.site",
    STAFF_SITE_URL="https://staff.niskalastudio.site",
    CORS_ALLOWED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    CSRF_TRUSTED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    LEGACY_INVITATION_LINKS_ENABLED=False,
    **PRODUCTION_RUNTIME_SECURITY,
)
def test_production_configuration_accepts_mfa_and_explicit_hosts():
    assert production_configuration_errors() == []

    with override_settings(STAFF_SESSION_ABSOLUTE_TTL_SECONDS=50_000):
        excessive_ttl_errors = production_configuration_errors()
    with override_settings(
        STAFF_SESSION_ABSOLUTE_TTL_SECONDS=1_800,
        STAFF_SESSION_IDLE_TTL_SECONDS=3_600,
        SESSION_COOKIE_AGE=1_800,
    ):
        ordering_errors = production_configuration_errors()

    assert (
        "STAFF_SESSION_ABSOLUTE_TTL_SECONDS must be between 1 and 43200 seconds in production"
        in excessive_ttl_errors
    )
    assert (
        "STAFF_SESSION_IDLE_TTL_SECONDS must not exceed the absolute session TTL" in ordering_errors
    )


@override_settings(
    DEPLOYMENT_ENVIRONMENT="production",
    STAFF_MFA_REQUIRED=True,
    ALLOWED_HOSTS=["api.niskalastudio.site", "healthcheck.railway.app"],
    CAPABILITY_KEYS={"prod-2026": STRONG_CAPABILITY_KEY},
    CAPABILITY_PRIMARY_KEY_ID="prod-2026",
    PUBLIC_SITE_URL="https://niskalastudio.site",
    CLIENT_SITE_URL="https://client.niskalastudio.site",
    STAFF_SITE_URL="https://staff.niskalastudio.site",
    CORS_ALLOWED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    CSRF_TRUSTED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    LEGACY_INVITATION_LINKS_ENABLED=False,
    **PRODUCTION_RUNTIME_SECURITY,
)
def test_production_configuration_pins_site_origins_and_api_host():
    with override_settings(CLIENT_SITE_URL="https://attacker.invalid"):
        origin_errors = production_configuration_errors()
    with override_settings(ALLOWED_HOSTS=["api.niskalastudio.site", "attacker.invalid"]):
        host_errors = production_configuration_errors()
    with override_settings(
        DATABASES={
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": ":memory:",
            }
        }
    ):
        database_errors = production_configuration_errors()
    with override_settings(
        CACHES={
            "default": {
                "BACKEND": "django_redis.cache.RedisCache",
                "LOCATION": "redis://staging-redis.internal:6379/0",
            }
        },
        CELERY_BROKER_URL="redis://staging-redis.internal:6379/1",
        CELERY_RESULT_BACKEND="redis://staging-redis.internal:6379/2",
        CLOUDINARY_CLOUD_NAME="niskala-staging",
        DATABASE_DIRECT_URL=(
            "postgresql://niskala:test@staging-db-direct.internal:5432/niskala_prod"
        ),
    ):
        data_plane_errors = production_configuration_errors()

    assert "CLIENT_SITE_URL does not match its PRODUCTION_EXPECTED origin" in origin_errors
    assert "DJANGO_ALLOWED_HOSTS contains a host outside the production allowlist" in host_errors
    assert "Production DATABASE_URL must use PostgreSQL" in database_errors
    assert "REDIS_URL host does not match PRODUCTION_EXPECTED_REDIS_HOST" in data_plane_errors
    assert (
        "DATABASE_DIRECT_URL host does not match PRODUCTION_EXPECTED_DATABASE_DIRECT_HOST"
        in data_plane_errors
    )
    assert (
        "CLOUDINARY_CLOUD_NAME does not match PRODUCTION_EXPECTED_CLOUDINARY_CLOUD_NAME"
        in data_plane_errors
    )


@override_settings(
    DEPLOYMENT_ENVIRONMENT="production",
    STAFF_MFA_REQUIRED=True,
    ALLOWED_HOSTS=["api.niskalastudio.site"],
    CAPABILITY_KEYS={"prod-2026": STRONG_CAPABILITY_KEY},
    CAPABILITY_PRIMARY_KEY_ID="prod-2026",
    PUBLIC_SITE_URL="https://niskalastudio.site",
    CLIENT_SITE_URL="https://client.niskalastudio.site",
    STAFF_SITE_URL="https://staff.niskalastudio.site",
    CORS_ALLOWED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    CSRF_TRUSTED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    LEGACY_INVITATION_LINKS_ENABLED=False,
    **PRODUCTION_RUNTIME_SECURITY,
)
def test_production_configuration_rejects_missing_or_weak_bff_secret():
    with override_settings(NISKALA_BFF_SHARED_SECRET=""):
        missing_errors = production_configuration_errors()
    with override_settings(NISKALA_BFF_SHARED_SECRET="change-me-change-me-change-me-change-me"):
        placeholder_errors = production_configuration_errors()
    with override_settings(
        SECRET_KEY=PRODUCTION_RUNTIME_SECURITY["NISKALA_BFF_SHARED_SECRET"],
        CAPABILITY_KEYS={
            "current": STRONG_CAPABILITY_KEY,
            "previous": STRONG_CAPABILITY_KEY,
        },
        CAPABILITY_PRIMARY_KEY_ID="current",
    ):
        reused_errors = production_configuration_errors()

    assert "NISKALA_BFF_SHARED_SECRET must contain at least 32 bytes" in missing_errors
    assert "NISKALA_BFF_SHARED_SECRET must not use a placeholder value" in placeholder_errors
    assert "Capability keys must contain unique secret material" in reused_errors
    assert (
        "DJANGO_SECRET_KEY, NISKALA_BFF_SHARED_SECRET, and capability keys must be distinct"
        in reused_errors
    )


@override_settings(
    DEPLOYMENT_ENVIRONMENT="production",
    STAFF_MFA_REQUIRED=True,
    ALLOWED_HOSTS=["api.niskalastudio.site"],
    CAPABILITY_KEYS={"prod-2026": STRONG_CAPABILITY_KEY},
    CAPABILITY_PRIMARY_KEY_ID="prod-2026",
    PUBLIC_SITE_URL="https://niskalastudio.site",
    CLIENT_SITE_URL="https://client.niskalastudio.site",
    STAFF_SITE_URL="https://staff.niskalastudio.site",
    CORS_ALLOWED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    CSRF_TRUSTED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    LEGACY_INVITATION_LINKS_ENABLED=False,
    **PRODUCTION_RUNTIME_SECURITY,
)
def test_production_configuration_rejects_insecure_effective_runtime_settings():
    with override_settings(
        DEBUG=True,
        SECRET_KEY="unsafe-local-development-key",
        SECURE_SSL_REDIRECT=False,
        SESSION_COOKIE_SECURE=False,
        PREVIEW_ACCESS_COOKIE_NAME="niskala_preview",
    ):
        errors = production_configuration_errors()
    with override_settings(SECRET_KEY="s" * 64):
        low_diversity_errors = production_configuration_errors()

    assert "DEBUG must be false in production" in errors
    assert "DJANGO_SECRET_KEY must be a production secret" in errors
    assert "DJANGO_SECURE_SSL_REDIRECT must be true in production" in errors
    assert "SESSION_COOKIE_SECURE must be true in production" in errors
    assert "PREVIEW_ACCESS_COOKIE_NAME must be __Host-niskala_preview in production" in errors
    assert "DJANGO_SECRET_KEY must be a production secret" in low_diversity_errors


@override_settings(
    DEPLOYMENT_ENVIRONMENT="production",
    STAFF_MFA_REQUIRED=False,
    ALLOWED_HOSTS=["*"],
    CAPABILITY_KEYS={"prod-2026": STRONG_CAPABILITY_KEY},
    CAPABILITY_PRIMARY_KEY_ID="prod-2026",
    PUBLIC_SITE_URL="https://niskalastudio.site",
    CLIENT_SITE_URL="https://client.niskalastudio.site",
    STAFF_SITE_URL="https://staff.niskalastudio.site",
    CORS_ALLOWED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    CSRF_TRUSTED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    LEGACY_INVITATION_LINKS_ENABLED=False,
    **PRODUCTION_RUNTIME_SECURITY,
)
def test_production_configuration_rejects_disabled_mfa_and_wildcard_hosts():
    assert production_configuration_errors() == [
        "STAFF_MFA_REQUIRED must be true in production",
        "DJANGO_ALLOWED_HOSTS must not contain wildcard hosts in production",
    ]


@override_settings(
    DEPLOYMENT_ENVIRONMENT="production",
    STAFF_MFA_REQUIRED=True,
    ALLOWED_HOSTS=[],
    CAPABILITY_KEYS={"prod-2026": STRONG_CAPABILITY_KEY},
    CAPABILITY_PRIMARY_KEY_ID="prod-2026",
    PUBLIC_SITE_URL="https://niskalastudio.site",
    CLIENT_SITE_URL="https://client.niskalastudio.site",
    STAFF_SITE_URL="https://staff.niskalastudio.site",
    CORS_ALLOWED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    CSRF_TRUSTED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    LEGACY_INVITATION_LINKS_ENABLED=False,
    **PRODUCTION_RUNTIME_SECURITY,
)
def test_production_configuration_rejects_empty_host_allowlist():
    assert production_configuration_errors() == [
        "DJANGO_ALLOWED_HOSTS must contain an explicit production allowlist"
    ]


@override_settings(
    DEPLOYMENT_ENVIRONMENT="production",
    STAFF_MFA_REQUIRED=True,
    ALLOWED_HOSTS=[".niskalastudio.site"],
    CAPABILITY_KEYS={"prod-2026": STRONG_CAPABILITY_KEY},
    CAPABILITY_PRIMARY_KEY_ID="prod-2026",
    PUBLIC_SITE_URL="https://niskalastudio.site",
    CLIENT_SITE_URL="https://client.niskalastudio.site",
    STAFF_SITE_URL="https://staff.niskalastudio.site",
    CORS_ALLOWED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    CSRF_TRUSTED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
    ],
    LEGACY_INVITATION_LINKS_ENABLED=False,
    **PRODUCTION_RUNTIME_SECURITY,
)
def test_production_configuration_rejects_suffix_wildcard_host():
    assert production_configuration_errors() == [
        "DJANGO_ALLOWED_HOSTS must not contain wildcard hosts in production"
    ]


@override_settings(
    DEPLOYMENT_ENVIRONMENT="production",
    STAFF_MFA_REQUIRED=True,
    ALLOWED_HOSTS=["api.niskalastudio.site"],
    CAPABILITY_KEYS={"prod-2026": STRONG_CAPABILITY_KEY},
    CAPABILITY_PRIMARY_KEY_ID="prod-2026",
    PUBLIC_SITE_URL="https://niskalastudio.site",
    CLIENT_SITE_URL="https://client.niskalastudio.site",
    STAFF_SITE_URL="https://staff.niskalastudio.site",
    CORS_ALLOWED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
        "https://attacker.invalid",
    ],
    CSRF_TRUSTED_ORIGINS=[
        "https://niskalastudio.site",
        "https://client.niskalastudio.site",
        "https://staff.niskalastudio.site",
        "https://attacker.invalid",
    ],
    LEGACY_INVITATION_LINKS_ENABLED=False,
    **PRODUCTION_RUNTIME_SECURITY,
)
def test_production_configuration_rejects_extra_trusted_origins():
    assert production_configuration_errors() == [
        ("DJANGO_CORS_ALLOWED_ORIGINS must contain only public, client, and staff origins"),
        ("DJANGO_CSRF_TRUSTED_ORIGINS must contain only public, client, and staff origins"),
    ]


@override_settings(
    DEPLOYMENT_ENVIRONMENT="staging",
    NISKALA_BFF_SHARED_SECRET="Bff-2026!Az3#Km7$Np2%Qr5&St8*Vx1",
    ALLOWED_HOSTS=["api-staging.niskalastudio.site", "healthcheck.railway.app"],
    PUBLIC_SITE_URL="https://staging.niskalastudio.site",
    CLIENT_SITE_URL="https://client-staging.niskalastudio.site",
    STAFF_SITE_URL="https://staff-staging.niskalastudio.site",
    CORS_ALLOWED_ORIGINS=[
        "https://staging.niskalastudio.site",
        "https://client-staging.niskalastudio.site",
        "https://staff-staging.niskalastudio.site",
    ],
    CSRF_TRUSTED_ORIGINS=[
        "https://staging.niskalastudio.site",
        "https://client-staging.niskalastudio.site",
        "https://staff-staging.niskalastudio.site",
    ],
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "HOST": "pool.staging-db.invalid",
            "NAME": "niskala_staging",
        }
    },
    CACHES={"default": {"LOCATION": "rediss://staging-redis.invalid:6379/0"}},
    CELERY_BROKER_URL="rediss://staging-redis.invalid:6379/1",
    CELERY_RESULT_BACKEND="rediss://staging-redis.invalid:6379/2",
    CLOUDINARY_CLOUD_NAME="niskala-staging",
    SENTRY_ENVIRONMENT="staging",
    SESSION_COOKIE_DOMAIN=None,
    CSRF_COOKIE_DOMAIN=None,
)
@patch.dict(
    "os.environ",
    {
        "STAGING_EXPECTED_FRONTEND_ORIGIN": "https://staging.niskalastudio.site",
        "STAGING_EXPECTED_CLIENT_ORIGIN": "https://client-staging.niskalastudio.site",
        "STAGING_EXPECTED_STAFF_ORIGIN": "https://staff-staging.niskalastudio.site",
        "STAGING_EXPECTED_API_HOST": "api-staging.niskalastudio.site",
        "STAGING_EXPECTED_DATABASE_HOST": "pool.staging-db.invalid",
        "STAGING_EXPECTED_DATABASE_DIRECT_HOST": "direct.staging-db.invalid",
        "STAGING_EXPECTED_DATABASE_NAME": "niskala_staging",
        "STAGING_EXPECTED_REDIS_HOST": "staging-redis.invalid",
        "STAGING_EXPECTED_CLOUDINARY_CLOUD_NAME": "niskala-staging",
        "DATABASE_DIRECT_URL": (
            "postgresql://user:secret@direct.staging-db.invalid/niskala_staging"
        ),
    },
    clear=False,
)
def test_staging_configuration_accepts_exact_dedicated_resources():
    assert staging_configuration_errors() == []


@override_settings(
    DEPLOYMENT_ENVIRONMENT="staging",
    NISKALA_BFF_SHARED_SECRET="Bff-2026!Az3#Km7$Np2%Qr5&St8*Vx1",
    ALLOWED_HOSTS=["api-staging.niskalastudio.site", "healthcheck.railway.app"],
    PUBLIC_SITE_URL="https://staging.niskalastudio.site",
    CLIENT_SITE_URL="https://client-staging.niskalastudio.site",
    STAFF_SITE_URL="https://staff-staging.niskalastudio.site",
    CORS_ALLOWED_ORIGINS=[
        "https://staging.niskalastudio.site",
        "https://client-staging.niskalastudio.site",
        "https://staff-staging.niskalastudio.site",
    ],
    CSRF_TRUSTED_ORIGINS=[
        "https://staging.niskalastudio.site",
        "https://client-staging.niskalastudio.site",
        "https://staff-staging.niskalastudio.site",
    ],
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "HOST": "direct.staging-db.invalid",
            "NAME": "niskala_staging",
        }
    },
    CACHES={"default": {"LOCATION": "rediss://staging-redis.invalid:6379/0"}},
    CELERY_BROKER_URL="rediss://staging-redis.invalid:6379/1",
    CELERY_RESULT_BACKEND="rediss://staging-redis.invalid:6379/2",
    CLOUDINARY_CLOUD_NAME="niskala-staging",
    SENTRY_ENVIRONMENT="staging",
    SESSION_COOKIE_DOMAIN=None,
    CSRF_COOKIE_DOMAIN=None,
)
@patch.dict(
    "os.environ",
    {
        "NISKALA_RELEASE_DATABASE_MODE": "direct",
        "STAGING_EXPECTED_FRONTEND_ORIGIN": "https://staging.niskalastudio.site",
        "STAGING_EXPECTED_CLIENT_ORIGIN": "https://client-staging.niskalastudio.site",
        "STAGING_EXPECTED_STAFF_ORIGIN": "https://staff-staging.niskalastudio.site",
        "STAGING_EXPECTED_API_HOST": "api-staging.niskalastudio.site",
        "STAGING_EXPECTED_DATABASE_HOST": "pool.staging-db.invalid",
        "STAGING_EXPECTED_DATABASE_DIRECT_HOST": "direct.staging-db.invalid",
        "STAGING_EXPECTED_DATABASE_NAME": "niskala_staging",
        "STAGING_EXPECTED_REDIS_HOST": "staging-redis.invalid",
        "STAGING_EXPECTED_CLOUDINARY_CLOUD_NAME": "niskala-staging",
        "DATABASE_DIRECT_URL": (
            "postgresql://user:secret@direct.staging-db.invalid/niskala_staging"
        ),
    },
    clear=False,
)
def test_staging_configuration_accepts_direct_database_for_release_commands():
    assert staging_configuration_errors() == []


@override_settings(DEPLOYMENT_ENVIRONMENT="production")
def test_staging_seed_refuses_production():
    with pytest.raises(CommandError, match="only run in staging"):
        call_command("seed_staging_demo")


@pytest.mark.django_db
@override_settings(DEPLOYMENT_ENVIRONMENT="staging")
@patch.dict(
    "os.environ",
    {
        "STAGING_DEMO_STAFF_PASSWORD": "staging-only-password-12345",
        "STAGING_DEMO_MFA_KEY": "11" * 20,
    },
    clear=False,
)
def test_staging_seed_is_idempotent_and_uses_existing_models():
    call_command("seed_staging_demo", verbosity=0)
    call_command("seed_staging_demo", verbosity=0)

    invitation = Invitation.objects.get(public_slug="staging-isolation-demo")
    assert invitation.status == Invitation.Status.PUBLISHED
    assert Order.objects.filter(reference="STG-ISOLATION-CHECK", invitation=invitation).count() == 1
    guest = Guest.objects.get(invitation=invitation)
    assert not is_password_usable(guest.access_token_hash)
    assert "delivery_token" not in guest.metadata

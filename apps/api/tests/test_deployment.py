from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from common.deployment import staging_configuration_errors
from config.release import prepare_release_environment
from invitations.models import Guest, Invitation
from orders.models import Order


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
    DEPLOYMENT_ENVIRONMENT="staging",
    ALLOWED_HOSTS=["api-staging.niskalastudio.site", "healthcheck.railway.app"],
    CORS_ALLOWED_ORIGINS=["https://staging.niskalastudio.site"],
    CSRF_TRUSTED_ORIGINS=["https://staging.niskalastudio.site"],
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
    MIDTRANS_IS_PRODUCTION=False,
)
@patch.dict(
    "os.environ",
    {
        "STAGING_EXPECTED_FRONTEND_ORIGIN": "https://staging.niskalastudio.site",
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
    ALLOWED_HOSTS=["api-staging.niskalastudio.site", "healthcheck.railway.app"],
    CORS_ALLOWED_ORIGINS=["https://staging.niskalastudio.site"],
    CSRF_TRUSTED_ORIGINS=["https://staging.niskalastudio.site"],
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
    MIDTRANS_IS_PRODUCTION=False,
)
@patch.dict(
    "os.environ",
    {
        "NISKALA_RELEASE_DATABASE_MODE": "direct",
        "STAGING_EXPECTED_FRONTEND_ORIGIN": "https://staging.niskalastudio.site",
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
        "STAGING_DEMO_GUEST_TOKEN": "synthetic-staging-guest-token-1234567890",
    },
    clear=False,
)
def test_staging_seed_is_idempotent_and_uses_existing_models():
    call_command("seed_staging_demo", verbosity=0)
    call_command("seed_staging_demo", verbosity=0)

    invitation = Invitation.objects.get(public_slug="staging-isolation-demo")
    assert invitation.status == Invitation.Status.PUBLISHED
    assert Order.objects.filter(reference="STG-ISOLATION-CHECK", invitation=invitation).count() == 1
    assert Guest.objects.filter(invitation=invitation).count() == 1

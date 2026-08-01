from __future__ import annotations

import json
import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
import sentry_sdk

from common.sentry import before_breadcrumb, before_send

BASE_DIR = Path(__file__).resolve().parents[2]


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None:
        raise RuntimeError(f"Required environment variable {name} is not set")
    return value


def env_optional(name: str) -> str | None:
    value = os.environ.get(name, "").strip()
    return value or None


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in env(name, default).split(",") if item.strip()]


def env_bool(name: str, default: bool = False) -> bool:
    return env(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_float(name: str, default: float) -> float:
    return float(env(name, str(default)))


def env_int(name: str, default: int) -> int:
    return int(env(name, str(default)))


def env_json(name: str, default: str) -> object:
    try:
        return json.loads(env(name, default))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Environment variable {name} must contain valid JSON") from exc


SECRET_KEY = env("DJANGO_SECRET_KEY", "unsafe-local-development-key")
DEBUG = False
DEPLOYMENT_ENVIRONMENT = (
    env("DEPLOYMENT_ENVIRONMENT", env("RAILWAY_ENVIRONMENT_NAME", "development")).strip().lower()
)
DEPLOYMENT_RELEASE = (
    env("DEPLOYMENT_RELEASE", env("RAILWAY_GIT_COMMIT_SHA", "local")).strip() or "local"
)
NISKALA_BFF_SHARED_SECRET = env("NISKALA_BFF_SHARED_SECRET", "").strip()
SENTRY_ENVIRONMENT = env("SENTRY_ENVIRONMENT", DEPLOYMENT_ENVIRONMENT)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
PUBLIC_SITE_URL = env("PUBLIC_SITE_URL", "http://localhost:3000").rstrip("/")
CLIENT_SITE_URL = env("CLIENT_SITE_URL", PUBLIC_SITE_URL).rstrip("/")
STAFF_SITE_URL = env("STAFF_SITE_URL", CLIENT_SITE_URL).rstrip("/")
PRODUCTION_EXPECTED_PUBLIC_ORIGIN = env("PRODUCTION_EXPECTED_PUBLIC_ORIGIN", "").rstrip("/")
PRODUCTION_EXPECTED_CLIENT_ORIGIN = env("PRODUCTION_EXPECTED_CLIENT_ORIGIN", "").rstrip("/")
PRODUCTION_EXPECTED_STAFF_ORIGIN = env("PRODUCTION_EXPECTED_STAFF_ORIGIN", "").rstrip("/")
PRODUCTION_EXPECTED_API_HOST = env("PRODUCTION_EXPECTED_API_HOST", "").strip().lower()
PRODUCTION_EXPECTED_DATABASE_HOST = env("PRODUCTION_EXPECTED_DATABASE_HOST", "").strip().lower()
PRODUCTION_EXPECTED_DATABASE_DIRECT_HOST = (
    env("PRODUCTION_EXPECTED_DATABASE_DIRECT_HOST", "").strip().lower()
)
PRODUCTION_EXPECTED_DATABASE_NAME = env("PRODUCTION_EXPECTED_DATABASE_NAME", "").strip()
PRODUCTION_EXPECTED_REDIS_HOST = env("PRODUCTION_EXPECTED_REDIS_HOST", "").strip().lower()
PRODUCTION_EXPECTED_CLOUDINARY_CLOUD_NAME = env(
    "PRODUCTION_EXPECTED_CLOUDINARY_CLOUD_NAME", ""
).strip()
CAPABILITY_KEYS = env_json(
    "CAPABILITY_KEYS_JSON",
    '{"local":"local-development-capability-key-change-me-32-bytes"}',
)
CAPABILITY_PRIMARY_KEY_ID = env("CAPABILITY_PRIMARY_KEY_ID", "local")
LEGACY_INVITATION_LINKS_ENABLED = env_bool("LEGACY_INVITATION_LINKS_ENABLED", False)
LEGACY_INVITATION_LINK_CUTOFF = env("LEGACY_INVITATION_LINK_CUTOFF", "")
CLIENT_ACCESS_COOKIE_NAME = env("CLIENT_ACCESS_COOKIE_NAME", "niskala_client")
GUEST_ACCESS_COOKIE_NAME = env("GUEST_ACCESS_COOKIE_NAME", "niskala_guest")
PREVIEW_ACCESS_COOKIE_NAME = env("PREVIEW_ACCESS_COOKIE_NAME", "niskala_preview")

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "axes",
    "corsheaders",
    "django_otp",
    "django_otp.plugins.otp_totp",
    "rest_framework",
    "drf_spectacular",
    "csp",
    "common",
    "users",
    "catalog",
    "invitations",
    "weather",
    "leads",
    "media_library",
    "site_settings",
    "orders",
    "payments",
    "analytics",
    "tickets",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "common.middleware.BFFOriginAuthenticationMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django_otp.middleware.OTPMiddleware",
    "common.middleware.StaffSessionSecurityMiddleware",
    "common.middleware.DatabaseAccessContextMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "common.middleware.RequestIdMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "csp.middleware.CSPMiddleware",
    "axes.middleware.AxesMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": dj_database_url.parse(
        env("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
        conn_max_age=60,
        conn_health_checks=True,
    )
}
DATABASE_DIRECT_URL = env("DATABASE_DIRECT_URL", "")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": env("REDIS_URL", "redis://localhost:6379/0"),
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
        "KEY_PREFIX": "wedding",
        "TIMEOUT": 300,
    }
}

BILLING_EXPIRY_WARNING_DAYS = env_int("BILLING_EXPIRY_WARNING_DAYS", 14)

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]

AUTH_USER_MODEL = "users.User"
AUTHENTICATION_BACKENDS = [
    "axes.backends.AxesStandaloneBackend",
    "django.contrib.auth.backends.ModelBackend",
]

AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = timedelta(minutes=15)
AXES_LOCKOUT_PARAMETERS = ["username"]
AXES_RESET_ON_SUCCESS = True
AXES_HTTP_RESPONSE_CODE = 429

STAFF_MFA_REQUIRED = env_bool("STAFF_MFA_REQUIRED", False)
STAFF_MFA_CHALLENGE_TTL_SECONDS = env_int("STAFF_MFA_CHALLENGE_TTL_SECONDS", 300)
STAFF_MFA_REAUTH_TTL_SECONDS = env_int("STAFF_MFA_REAUTH_TTL_SECONDS", 1_800)
STAFF_SESSION_ABSOLUTE_TTL_SECONDS = env_int(
    "STAFF_SESSION_ABSOLUTE_TTL_SECONDS",
    28_800,
)
STAFF_SESSION_IDLE_TTL_SECONDS = env_int("STAFF_SESSION_IDLE_TTL_SECONDS", 1_800)
STAFF_SESSION_TOUCH_INTERVAL_SECONDS = env_int(
    "STAFF_SESSION_TOUCH_INTERVAL_SECONDS",
    60,
)

LANGUAGE_CODE = "id"
LANGUAGES = [("id", "Bahasa Indonesia"), ("en", "English")]
TIME_ZONE = "Asia/Jakarta"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = env_list("DJANGO_CORS_ALLOWED_ORIGINS", "http://localhost:3000")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:3000")
CORS_ALLOW_CREDENTIALS = True

DATA_UPLOAD_MAX_MEMORY_SIZE = env_int("DJANGO_MAX_REQUEST_BYTES", 2 * 1024 * 1024)
FILE_UPLOAD_MAX_MEMORY_SIZE = DATA_UPLOAD_MAX_MEMORY_SIZE

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "common.throttles.AuthenticatedUserRateThrottle",
        "common.throttles.NiskalaScopedRateThrottle",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "common.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_RATES": {
        "user": "300/minute",
        "conversion": "20/min",
        "csrf": "30/min",
        "client_access": "5/15min",
        "grant_redeem": "20/min",
        "guest_import": "5/min",
        "login": "5/5min",
        "mfa": "10/5min",
        "rsvp": "10/min",
    },
}

API_DOCS_ENABLED = env_bool("DJANGO_API_DOCS_ENABLED", True)

SPECTACULAR_SETTINGS = {
    "TITLE": "Wedding Invitation API",
    "DESCRIPTION": "Versioned API for the Wedding Invitation Studio.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

CELERY_BROKER_URL = env("CELERY_BROKER_URL", "redis://localhost:6379/1")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_TIME_LIMIT = 60
CELERY_TASK_SOFT_TIME_LIMIT = 50
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
    "refresh-invitation-lifecycle": {
        "task": "orders.tasks.refresh_invitation_lifecycle",
        "schedule": 3_600,
    },
    "refresh-upcoming-wedding-weather": {
        "task": "weather.tasks.schedule_upcoming_weather_refreshes",
        "schedule": 21_600,
    },
}

OPEN_METEO_API_BASE_URL = env("OPEN_METEO_API_BASE_URL", "https://api.open-meteo.com")
OPEN_METEO_REQUEST_TIMEOUT_SECONDS = int(env("OPEN_METEO_REQUEST_TIMEOUT_SECONDS", "5"))
OPEN_METEO_CACHE_TTL_SECONDS = int(env("OPEN_METEO_CACHE_TTL_SECONDS", "21600"))

WHATSAPP_BUSINESS_NUMBER = env("WHATSAPP_BUSINESS_NUMBER", "")
WHATSAPP_MESSAGE_TEMPLATE_ID = env("WHATSAPP_MESSAGE_TEMPLATE_ID", "")
WHATSAPP_MESSAGE_TEMPLATE_EN = env("WHATSAPP_MESSAGE_TEMPLATE_EN", "")

CLOUDINARY_CLOUD_NAME = env("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = env("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = env("CLOUDINARY_API_SECRET", "")

SENTRY_DSN = env("SENTRY_DSN", "")
if SENTRY_DSN:
    sentry_sdk.init(
        before_breadcrumb=before_breadcrumb,
        before_send=before_send,
        before_send_transaction=before_send,
        dsn=SENTRY_DSN,
        environment=SENTRY_ENVIRONMENT,
        include_local_variables=False,
        release=env("SENTRY_RELEASE", ""),
        send_default_pii=False,
        traces_sample_rate=env_float("SENTRY_TRACES_SAMPLE_RATE", 0.05),
    )

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "common.logging.JsonFormatter",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        }
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "wedding": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_AGE = env_int("DJANGO_SESSION_COOKIE_AGE", 28_800)
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_SAVE_EVERY_REQUEST = False
SESSION_COOKIE_SAMESITE = env("DJANGO_SESSION_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = env("DJANGO_CSRF_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_DOMAIN = env_optional("DJANGO_SESSION_COOKIE_DOMAIN")
CSRF_COOKIE_DOMAIN = env_optional("DJANGO_CSRF_COOKIE_DOMAIN")

CONTENT_SECURITY_POLICY = {
    "DIRECTIVES": {
        "default-src": ("'self'",),
        "img-src": ("'self'", "data:", "https://res.cloudinary.com"),
        "font-src": ("'self'", "data:"),
        "style-src": ("'self'", "'unsafe-inline'"),
        "script-src": ("'self'",),
        "connect-src": ("'self'",),
        "frame-ancestors": ("'none'",),
        "base-uri": ("'self'",),
        "form-action": ("'self'",),
    }
}

from config.settings.base import *  # noqa: F403
from config.settings.base import env_bool

DEBUG = False
API_DOCS_ENABLED = env_bool("DJANGO_API_DOCS_ENABLED", False)
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405

required_environment = (
    "DJANGO_SECRET_KEY",
    "DJANGO_ALLOWED_HOSTS",
    "DJANGO_CORS_ALLOWED_ORIGINS",
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "DATABASE_URL",
    "DATABASE_DIRECT_URL",
    "REDIS_URL",
    "CELERY_BROKER_URL",
    "CELERY_RESULT_BACKEND",
    "CAPABILITY_KEYS_JSON",
    "CAPABILITY_PRIMARY_KEY_ID",
    "NISKALA_BFF_SHARED_SECRET",
    "PUBLIC_SITE_URL",
    "CLIENT_SITE_URL",
    "STAFF_SITE_URL",
)
if DEPLOYMENT_ENVIRONMENT == "production":  # noqa: F405
    required_environment += (
        "PRODUCTION_EXPECTED_PUBLIC_ORIGIN",
        "PRODUCTION_EXPECTED_CLIENT_ORIGIN",
        "PRODUCTION_EXPECTED_STAFF_ORIGIN",
        "PRODUCTION_EXPECTED_API_HOST",
        "PRODUCTION_EXPECTED_DATABASE_HOST",
        "PRODUCTION_EXPECTED_DATABASE_DIRECT_HOST",
        "PRODUCTION_EXPECTED_DATABASE_NAME",
        "PRODUCTION_EXPECTED_REDIS_HOST",
        "PRODUCTION_EXPECTED_CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
        "SENTRY_DSN",
        "SENTRY_ENVIRONMENT",
    )
missing_environment = [name for name in required_environment if not os.environ.get(name)]  # noqa: F405
if missing_environment:
    raise RuntimeError(
        "Missing required production environment variables: "
        + ", ".join(sorted(missing_environment))
    )

if DEPLOYMENT_ENVIRONMENT not in {"production", "staging"}:  # noqa: F405
    raise RuntimeError(
        "DEPLOYMENT_ENVIRONMENT must resolve to production or staging in production settings"
    )
if DEPLOYMENT_RELEASE == "local":  # noqa: F405
    raise RuntimeError(
        "DEPLOYMENT_RELEASE or RAILWAY_GIT_COMMIT_SHA must identify the deployed release"
    )

SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_REDIRECT_EXEMPT = [r"^health/(live|ready)$"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_NAME = "__Host-niskala_staff"
CSRF_COOKIE_NAME = "__Host-niskala_csrf"
SESSION_COOKIE_SAMESITE = "Strict"
CSRF_COOKIE_SAMESITE = "Strict"
CLIENT_ACCESS_COOKIE_NAME = "__Host-niskala_client"
GUEST_ACCESS_COOKIE_NAME = "__Host-niskala_guest"
PREVIEW_ACCESS_COOKIE_NAME = "__Host-niskala_preview"
SECURE_HSTS_SECONDS = 31_536_000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"

if SECRET_KEY == "unsafe-local-development-key":  # noqa: F405
    raise RuntimeError("DJANGO_SECRET_KEY must be configured in production")

if DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql":  # noqa: F405
    DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = env_bool(  # noqa: F405
        "DATABASE_DISABLE_SERVER_SIDE_CURSORS",
        True,
    )

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

from config.settings.base import *  # noqa: F403
from config.settings.base import env_bool

DEBUG = False
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
    "WHATSAPP_BUSINESS_NUMBER",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
)
missing_environment = [name for name in required_environment if not os.environ.get(name)]  # noqa: F405
if missing_environment:
    raise RuntimeError(
        "Missing required production environment variables: "
        + ", ".join(sorted(missing_environment))
    )

SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31_536_000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

if SECRET_KEY == "unsafe-local-development-key":  # noqa: F405
    raise RuntimeError("DJANGO_SECRET_KEY must be configured in production")

if DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql":  # noqa: F405
    DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = env_bool(  # noqa: F405
        "DATABASE_DISABLE_SERVER_SIDE_CURSORS",
        True,
    )

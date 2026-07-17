from django.apps import AppConfig


class CommonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "common"

    def ready(self) -> None:
        from common.deployment import staging_configuration_errors

        staging_errors = staging_configuration_errors()
        if staging_errors:
            raise RuntimeError("Unsafe staging configuration: " + "; ".join(staging_errors))
        from common import checks, signals  # noqa: F401

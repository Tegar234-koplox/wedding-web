from django.core import checks

from common.deployment import staging_configuration_errors


@checks.register(checks.Tags.security, deploy=True)
def check_staging_isolation(app_configs, **kwargs):
    del app_configs, kwargs
    return [
        checks.Error(message, id=f"common.E{index:03d}")
        for index, message in enumerate(staging_configuration_errors(), start=1)
    ]

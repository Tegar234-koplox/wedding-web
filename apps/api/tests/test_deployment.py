import pytest

from config.release import prepare_release_environment


def test_release_environment_uses_direct_database_url():
    environment = {
        "DATABASE_URL": "postgresql://pooled",
        "DATABASE_DIRECT_URL": "postgresql://direct",
    }

    prepare_release_environment(environment)

    assert environment["DATABASE_URL"] == "postgresql://direct"
    assert environment["DJANGO_SETTINGS_MODULE"] == "config.settings.production"


def test_release_environment_requires_direct_database_url():
    with pytest.raises(RuntimeError, match="DATABASE_DIRECT_URL"):
        prepare_release_environment({})

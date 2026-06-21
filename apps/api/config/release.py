from __future__ import annotations

import os
import sys
from collections.abc import MutableMapping


def prepare_release_environment(environment: MutableMapping[str, str]) -> None:
    direct_url = environment.get("DATABASE_DIRECT_URL", "").strip()
    if not direct_url:
        raise RuntimeError("DATABASE_DIRECT_URL is required for release commands.")

    environment["DATABASE_URL"] = direct_url
    environment.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")


def main() -> None:
    prepare_release_environment(os.environ)

    from django.core.management import execute_from_command_line

    execute_from_command_line(["manage.py", *sys.argv[1:]])


if __name__ == "__main__":
    main()

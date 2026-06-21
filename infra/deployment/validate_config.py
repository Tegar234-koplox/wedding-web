from __future__ import annotations

import json
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    vercel = json.loads((ROOT / "apps/web/vercel.json").read_text(encoding="utf-8"))
    if vercel.get("framework") != "nextjs":
        raise RuntimeError("apps/web/vercel.json must declare the Next.js framework.")

    expected_commands = {
        "web.toml": "gunicorn ",
        "worker.toml": "celery -A config worker",
        "beat.toml": "celery -A config beat",
    }
    for filename, command_prefix in expected_commands.items():
        path = ROOT / "infra/deployment/railway" / filename
        config = tomllib.loads(path.read_text(encoding="utf-8"))
        if config.get("build", {}).get("builder") != "DOCKERFILE":
            raise RuntimeError(f"{filename} must use the Dockerfile builder.")
        start_command = config.get("deploy", {}).get("startCommand", "")
        if not start_command.startswith(command_prefix):
            raise RuntimeError(f"{filename} has an unexpected start command.")

    web = tomllib.loads(
        (ROOT / "infra/deployment/railway/web.toml").read_text(encoding="utf-8")
    )
    if web["deploy"].get("healthcheckPath") != "/health/ready":
        raise RuntimeError("Railway web service must use the readiness endpoint.")
    if "config.release migrate" not in web["deploy"].get("preDeployCommand", ""):
        raise RuntimeError("Railway web service must run direct-connection migrations.")

    print("Deployment configuration is valid.")


if __name__ == "__main__":
    main()

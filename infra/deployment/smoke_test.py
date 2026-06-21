from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class Check:
    name: str
    url: str
    expected_status: int = 200
    expected_json_status: str | None = None


def normalized_origin(value: str) -> str:
    return value.rstrip("/") + "/"


def run_check(check: Check, timeout: float) -> tuple[bool, str]:
    request = Request(
        check.url,
        headers={
            "Accept": "application/json,text/html",
            "User-Agent": "niskala-deployment-smoke/1.0",
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            status = response.status
            body = response.read()
    except HTTPError as exc:
        return False, f"{check.name}: HTTP {exc.code} ({check.url})"
    except URLError as exc:
        return False, f"{check.name}: connection failed: {exc.reason} ({check.url})"

    if status != check.expected_status:
        return (
            False,
            f"{check.name}: expected {check.expected_status}, received {status}",
        )

    if check.expected_json_status is not None:
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return False, f"{check.name}: response was not valid JSON"
        if payload.get("status") != check.expected_json_status:
            return (
                False,
                f"{check.name}: unexpected status payload {payload.get('status')!r}",
            )

    return True, f"{check.name}: ok"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Smoke-test a deployed Niskala release."
    )
    parser.add_argument(
        "--site-url", required=True, help="Frontend origin, for example https://x.com"
    )
    parser.add_argument(
        "--api-url", required=True, help="API origin, for example https://api.x.com"
    )
    parser.add_argument("--timeout", type=float, default=15)
    args = parser.parse_args()

    site_origin = normalized_origin(args.site_url)
    api_origin = normalized_origin(args.api_url)
    checks = (
        Check("homepage", urljoin(site_origin, "id")),
        Check("theme catalog", urljoin(site_origin, "id/themes")),
        Check(
            "API liveness",
            urljoin(api_origin, "health/live"),
            expected_json_status="ok",
        ),
        Check(
            "API readiness",
            urljoin(api_origin, "health/ready"),
            expected_json_status="ok",
        ),
        Check("public themes API", urljoin(api_origin, "api/v1/themes?locale=id")),
        Check("public packages API", urljoin(api_origin, "api/v1/packages?locale=id")),
    )

    failed = False
    for check in checks:
        passed, message = run_check(check, args.timeout)
        print(("PASS" if passed else "FAIL") + f"  {message}")
        failed = failed or not passed

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

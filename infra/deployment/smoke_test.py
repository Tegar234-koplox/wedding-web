from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class Check:
    name: str
    url: str
    expected_status: int = 200
    expected_final_path: str | None = None
    expected_json_key: str | None = None
    expected_json_status: str | None = None
    expected_json_values: dict[str, str] = field(default_factory=dict)
    expected_headers: dict[str, str] = field(default_factory=dict)


def normalized_origin(value: str) -> str:
    return value.rstrip("/") + "/"


def run_check(
    check: Check,
    timeout: float,
    request_headers: dict[str, str] | None = None,
) -> tuple[bool, str]:
    headers = {
        "Accept": "application/json,text/html",
        "User-Agent": "niskala-deployment-smoke/1.0",
    }
    headers.update(request_headers or {})
    request = Request(
        check.url,
        headers=headers,
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            status = response.status
            body = response.read()
    except HTTPError as exc:
        if exc.code == check.expected_status:
            return True, f"{check.name}: ok"
        return False, f"{check.name}: HTTP {exc.code} ({check.url})"
    except URLError as exc:
        return False, f"{check.name}: connection failed: {exc.reason} ({check.url})"

    if status != check.expected_status:
        return (
            False,
            f"{check.name}: expected {check.expected_status}, received {status}",
        )

    if check.expected_final_path is not None:
        final_path = urlparse(response.geturl()).path
        if final_path != check.expected_final_path:
            return (
                False,
                f"{check.name}: expected redirect to {check.expected_final_path}, got {final_path}",
            )

    for header, expected in check.expected_headers.items():
        received = response.headers.get(header)
        if received != expected:
            return (
                False,
                f"{check.name}: expected {header}={expected!r}, received {received!r}",
            )

    if (
        check.expected_json_status is not None
        or check.expected_json_key is not None
        or check.expected_json_values
    ):
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return False, f"{check.name}: response was not valid JSON"
        if (
            check.expected_json_key is not None
            and check.expected_json_key not in payload
        ):
            return False, f"{check.name}: missing JSON key {check.expected_json_key!r}"
        if payload.get("status") != check.expected_json_status:
            return (
                False,
                f"{check.name}: unexpected status payload {payload.get('status')!r}",
            )
        for key, expected in check.expected_json_values.items():
            if payload.get(key) != expected:
                return (
                    False,
                    f"{check.name}: expected JSON {key}={expected!r}, "
                    f"received {payload.get(key)!r}",
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
    parser.add_argument("--expected-environment")
    parser.add_argument("--expected-release")
    parser.add_argument("--cf-access-client-id")
    parser.add_argument("--cf-access-client-secret")
    args = parser.parse_args()

    if bool(args.cf_access_client_id) != bool(args.cf_access_client_secret):
        parser.error("both Cloudflare Access credentials must be provided together")

    access_headers = {}
    if args.cf_access_client_id:
        access_headers = {
            "CF-Access-Client-Id": args.cf_access_client_id,
            "CF-Access-Client-Secret": args.cf_access_client_secret,
        }

    site_origin = normalized_origin(args.site_url)
    api_origin = normalized_origin(args.api_url)
    checks = (
        Check(
            "homepage",
            urljoin(site_origin, "id"),
            expected_headers={
                key: value
                for key, value in {
                    "X-Niskala-Environment": args.expected_environment,
                    "X-Niskala-Release": args.expected_release,
                }.items()
                if value
            },
        ),
        Check("theme catalog", urljoin(site_origin, "id/themes")),
        Check(
            "unauthenticated admin guard",
            urljoin(site_origin, "admin"),
            expected_final_path="/admin/login",
        ),
        Check(
            "API liveness",
            urljoin(api_origin, "health/live"),
            expected_json_status="ok",
            expected_json_values={
                key: value
                for key, value in {
                    "environment": args.expected_environment,
                    "release": args.expected_release,
                }.items()
                if value
            },
        ),
        Check(
            "API readiness",
            urljoin(api_origin, "health/ready"),
            expected_json_status="ok",
        ),
        Check("public themes API", urljoin(api_origin, "api/v1/themes?locale=id")),
        Check("public packages API", urljoin(api_origin, "api/v1/packages?locale=id")),
        Check(
            "CSRF bootstrap",
            urljoin(api_origin, "api/v1/auth/csrf"),
            expected_json_key="csrfToken",
        ),
        Check(
            "production API docs disabled",
            urljoin(api_origin, "api/docs/"),
            expected_status=404,
        ),
    )

    failed = False
    for check in checks:
        passed, message = run_check(check, args.timeout, access_headers)
        print(("PASS" if passed else "FAIL") + f"  {message}")
        failed = failed or not passed

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

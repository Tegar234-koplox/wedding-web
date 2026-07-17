from __future__ import annotations

import argparse
import sys
from urllib.parse import urlparse


def validated_origin(value: str, expected_host: str, label: str) -> str:
    candidate = value.strip().rstrip("/")
    if not candidate:
        raise ValueError(f"{label} URL is required")
    parsed = urlparse(candidate)
    if parsed.scheme != "https":
        raise ValueError(f"{label} must use HTTPS")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError(f"{label} must be a plain HTTPS origin")
    if parsed.path not in {"", "/"}:
        raise ValueError(f"{label} must not contain a path")
    if (parsed.hostname or "").lower() != expected_host.lower():
        raise ValueError(f"{label} host must be exactly {expected_host}")
    return f"https://{expected_host.lower()}"


def validate_isolation(
    frontend_url: str,
    api_url: str,
    production_frontend_url: str,
    production_api_url: str,
    expected_frontend_host: str,
    expected_api_host: str,
) -> tuple[str, str]:
    frontend = validated_origin(
        frontend_url, expected_frontend_host, "staging frontend"
    )
    api = validated_origin(api_url, expected_api_host, "staging API")
    if frontend == api:
        raise ValueError("staging frontend and API targets must be different")

    production_targets = {
        production_frontend_url.strip().rstrip("/").lower(),
        production_api_url.strip().rstrip("/").lower(),
    }
    if frontend.lower() in production_targets or api.lower() in production_targets:
        raise ValueError("a staging target resolves to a declared production target")
    production_hosts = {
        (urlparse(value).hostname or "").lower()
        for value in production_targets
        if value
    }
    if (
        expected_frontend_host.lower() in production_hosts
        or expected_api_host.lower() in production_hosts
    ):
        raise ValueError("an expected staging hostname is also declared as production")
    return frontend, api


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reject unsafe Niskala staging targets."
    )
    parser.add_argument("--frontend-url", required=True)
    parser.add_argument("--api-url", required=True)
    parser.add_argument("--production-frontend-url", required=True)
    parser.add_argument("--production-api-url", required=True)
    parser.add_argument("--expected-frontend-host", required=True)
    parser.add_argument("--expected-api-host", required=True)
    args = parser.parse_args()
    try:
        frontend, api = validate_isolation(
            args.frontend_url,
            args.api_url,
            args.production_frontend_url,
            args.production_api_url,
            args.expected_frontend_host,
            args.expected_api_host,
        )
    except ValueError as exc:
        print(f"FAIL  {exc}", file=sys.stderr)
        return 1
    print(f"PASS  isolated staging targets: {frontend} and {api}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

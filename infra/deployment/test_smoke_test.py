import json
import unittest
from email.message import Message
from unittest.mock import patch

from smoke_test import Check, run_check


class FakeResponse:
    def __init__(self, payload, headers=None):
        self.status = 200
        self._body = json.dumps(payload).encode()
        self.headers = Message()
        for key, value in (headers or {}).items():
            self.headers[key] = value

    def read(self):
        return self._body

    def geturl(self):
        return "https://api-staging.niskalastudio.site/health/live"

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class SmokeTestMarkerTests(unittest.TestCase):
    @patch("smoke_test.urlopen")
    def test_rejects_wrong_environment_marker(self, urlopen):
        urlopen.return_value = FakeResponse(
            {"status": "ok", "environment": "production", "release": "abc"}
        )
        passed, message = run_check(
            Check(
                "health",
                "https://api-staging.niskalastudio.site/health/live",
                expected_json_status="ok",
                expected_json_values={"environment": "staging", "release": "abc"},
            ),
            1,
        )
        self.assertFalse(passed)
        self.assertIn("environment", message)

    @patch("smoke_test.urlopen")
    def test_accepts_expected_headers_and_markers(self, urlopen):
        urlopen.return_value = FakeResponse(
            {"status": "ok", "environment": "staging", "release": "abc"},
            {"X-Niskala-Environment": "staging"},
        )
        passed, _ = run_check(
            Check(
                "health",
                "https://api-staging.niskalastudio.site/health/live",
                expected_json_status="ok",
                expected_json_values={"environment": "staging", "release": "abc"},
                expected_headers={"X-Niskala-Environment": "staging"},
            ),
            1,
        )
        self.assertTrue(passed)


if __name__ == "__main__":
    unittest.main()

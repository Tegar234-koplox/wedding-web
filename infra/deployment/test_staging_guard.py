import unittest

from staging_guard import validate_isolation


class StagingGuardTests(unittest.TestCase):
    def setUp(self):
        self.arguments = {
            "frontend_url": "https://staging.niskalastudio.site",
            "api_url": "https://api-staging.niskalastudio.site",
            "production_frontend_url": "https://www.niskalastudio.site",
            "production_api_url": "https://api.niskalastudio.site",
            "expected_frontend_host": "staging.niskalastudio.site",
            "expected_api_host": "api-staging.niskalastudio.site",
        }

    def test_accepts_exact_isolated_https_origins(self):
        self.assertEqual(
            validate_isolation(**self.arguments),
            (
                "https://staging.niskalastudio.site",
                "https://api-staging.niskalastudio.site",
            ),
        )

    def test_rejects_empty_target(self):
        self.arguments["frontend_url"] = ""
        with self.assertRaisesRegex(ValueError, "required"):
            validate_isolation(**self.arguments)

    def test_rejects_http_target(self):
        self.arguments["api_url"] = "http://api-staging.niskalastudio.site"
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            validate_isolation(**self.arguments)

    def test_rejects_wrong_hostname(self):
        self.arguments["frontend_url"] = "https://www.niskalastudio.site"
        with self.assertRaisesRegex(ValueError, "exactly"):
            validate_isolation(**self.arguments)

    def test_rejects_expected_host_declared_as_production(self):
        self.arguments["production_frontend_url"] = "https://staging.niskalastudio.site"
        with self.assertRaisesRegex(ValueError, "production"):
            validate_isolation(**self.arguments)


if __name__ == "__main__":
    unittest.main()

from common.sentry import scrub_sentry_payload, strip_url_secrets


def test_sentry_scrubber_removes_query_fragment_and_legacy_path_tokens():
    assert (
        strip_url_secrets("https://example.test/g?guest=secret#grant=ng1.secret")
        == "https://example.test/g"
    )
    event = {
        "request": {
            "data": {
                "challenge": "challenge-secret",
                "guest": "guest-secret",
                "initial_pin": "initial-pin-secret",
                "password": "password-secret",
                "preview": "preview-secret",
                "qr_data_url": "data:image/png;base64,totp-secret",
                "recovery_code": "single-recovery-secret",
                "recovery_codes": ["one", "two"],
                "signature": "cloudinary-upload-signature",
                "token": "grant-secret",
            },
            "url": "https://example.test/id/i/ref?preview=secret",
            "query_string": "preview=secret",
        },
        "breadcrumbs": [
            {"message": ("opened /guest-management/raw-secret and /client/access/bootstrap-secret")}
        ],
    }

    scrub_sentry_payload(event)

    assert event["request"] == {
        "data": {
            "challenge": "[Filtered]",
            "guest": "[Filtered]",
            "initial_pin": "[Filtered]",
            "password": "[Filtered]",
            "preview": "[Filtered]",
            "qr_data_url": "[Filtered]",
            "recovery_code": "[Filtered]",
            "recovery_codes": "[Filtered]",
            "signature": "[Filtered]",
            "token": "[Filtered]",
        },
        "url": "https://example.test/id/i/ref",
    }
    assert "/guest-management/[Filtered]" in event["breadcrumbs"][0]["message"]
    assert "/client/access/[Filtered]" in event["breadcrumbs"][0]["message"]
    secret_event = {"headers": {"CF-Access-Client-Secret": "service-secret"}}
    assert scrub_sentry_payload(secret_event) == {
        "headers": {"CF-Access-Client-Secret": "[Filtered]"}
    }

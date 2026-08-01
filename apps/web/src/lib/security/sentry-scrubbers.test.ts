import { describe, expect, it } from "vitest";

import {
  scrubSentryPayload,
  stripUrlSecrets,
} from "@/lib/security/sentry-scrubbers";

describe("Sentry capability scrubbing", () => {
  it("removes query strings and fragments from URL fields", () => {
    expect(
      stripUrlSecrets(
        "https://niskalastudio.site/g?preview=secret#grant=ng1.secret",
      ),
    ).toBe("https://niskalastudio.site/g");
  });

  it("redacts capability values in nested event strings and legacy paths", () => {
    const event = {
      breadcrumbs: [
        {
          data: {
            url: "https://example.test/id/i/ref?guest=secret",
          },
          message:
            "opened /guest-delivery/raw-secret and /client/access/bootstrap-secret",
        },
      ],
      request: {
        data: {
          challenge: "challenge-secret",
          guest: "guest-secret",
          initial_pin: "initial-pin-secret",
          password: "password-secret",
          preview: "preview-secret",
          qr_data_url: "data:image/png;base64,totp-secret",
          recovery_code: "single-recovery-secret",
          recovery_codes: ["one", "two"],
          signature: "cloudinary-upload-signature",
          token: "grant-secret",
        },
        query_string: "access=secret",
        url: "https://example.test/id/i/ref/wishes?access=secret",
      },
    };

    scrubSentryPayload(event);

    expect(event.request.url).toBe("https://example.test/id/i/ref/wishes");
    expect(event.request).not.toHaveProperty("query_string");
    expect(event.request.data).toEqual({
      challenge: "[Filtered]",
      guest: "[Filtered]",
      initial_pin: "[Filtered]",
      password: "[Filtered]",
      preview: "[Filtered]",
      qr_data_url: "[Filtered]",
      recovery_code: "[Filtered]",
      recovery_codes: "[Filtered]",
      signature: "[Filtered]",
      token: "[Filtered]",
    });
    expect(event.breadcrumbs[0]?.data.url).toBe("https://example.test/id/i/ref");
    expect(event.breadcrumbs[0]?.message).toContain(
      "/guest-delivery/[Filtered]",
    );
    expect(event.breadcrumbs[0]?.message).toContain(
      "/client/access/[Filtered]",
    );
    expect(
      scrubSentryPayload({
        headers: { "CF-Access-Client-Secret": "service-secret" },
      }),
    ).toEqual({ headers: { "CF-Access-Client-Secret": "[Filtered]" } });
  });
});

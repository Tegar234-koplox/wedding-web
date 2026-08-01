import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(url: string, host: string, cookie?: string) {
  return new NextRequest(url, {
    headers: {
      Host: host,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
}

function configureProductionHosts() {
  vi.stubEnv(
    "NISKALA_PUBLIC_HOSTS",
    "niskalastudio.site,www.niskalastudio.site",
  );
  vi.stubEnv("NISKALA_CLIENT_HOSTS", "client.niskalastudio.site");
  vi.stubEnv("NISKALA_STAFF_HOSTS", "staff.niskalastudio.site");
}

describe("frontend trust-zone proxy", () => {
  it("rejects a staff path on the public production host", () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "production");
    configureProductionHosts();

    const response = proxy(
      request("https://niskalastudio.site/admin/login", "niskalastudio.site"),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, noarchive");
  });

  it("allows the staff login only on the staff host with nonce CSP", () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "production");
    configureProductionHosts();

    const response = proxy(
      request(
        "https://staff.niskalastudio.site/admin/login",
        "staff.niskalastudio.site",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-security-policy")).toContain(
      "script-src 'self' 'nonce-",
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("marks guest capability URLs private and does not expose the API origin", () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "production");
    configureProductionHosts();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.niskalastudio.site/api/v1");

    const response = proxy(
      request(
        "https://niskalastudio.site/id/i/n001?guest=secret",
        "niskalastudio.site",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-security-policy")).not.toContain(
      "api.niskalastudio.site",
    );
    expect(response.headers.get("x-frame-options")).toBe("DENY");

    const redeemLanding = proxy(
      request("https://niskalastudio.site/g", "niskalastudio.site"),
    );
    const guestSession = proxy(
      request(
        "https://niskalastudio.site/id/i/guest-session",
        "niskalastudio.site",
        "__Host-niskala_guest=session-secret",
      ),
    );
    expect(redeemLanding.headers.get("cache-control")).toContain("no-store");
    expect(guestSession.headers.get("cache-control")).toContain("no-store");
    expect(guestSession.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("marks preview fragment redemption and preview sessions private", () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "production");
    configureProductionHosts();

    const landing = proxy(
      request(
        "https://niskalastudio.site/preview/access",
        "niskalastudio.site",
      ),
    );
    const redeem = proxy(
      request(
        "https://niskalastudio.site/api/preview/redeem",
        "niskalastudio.site",
      ),
    );
    const invitation = proxy(
      request(
        "https://niskalastudio.site/id/i/preview-session",
        "niskalastudio.site",
        "__Host-niskala_preview=session-secret",
      ),
    );

    for (const response of [landing, redeem, invitation]) {
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, noarchive");
    }
    expect(invitation.headers.get("x-frame-options")).toBeNull();
  });

  it("protects the legacy wishes access query from caches and referrers", () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "production");
    configureProductionHosts();

    const response = proxy(
      request(
        "https://niskalastudio.site/id/i/n001/wishes?access=legacy-secret",
        "niskalastudio.site",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, noarchive");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("rejects Vercel's default production hostname", () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "production");
    configureProductionHosts();

    const response = proxy(
      request(
        "https://wedding-web.vercel.app/id/themes",
        "wedding-web.vercel.app",
      ),
    );

    expect(response.status).toBe(404);
  });

  it("keeps client session APIs on the client host and guest redemption public", () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "production");
    configureProductionHosts();

    const wrongClientHost = proxy(
      request(
        "https://niskalastudio.site/api/client/bootstrap",
        "niskalastudio.site",
      ),
    );
    const clientHost = proxy(
      request(
        "https://client.niskalastudio.site/api/client/bootstrap",
        "client.niskalastudio.site",
      ),
    );
    const guestHost = proxy(
      request(
        "https://niskalastudio.site/api/guest/redeem",
        "niskalastudio.site",
      ),
    );

    expect(wrongClientHost.status).toBe(404);
    expect(clientHost.status).toBe(200);
    expect(clientHost.headers.get("cache-control")).toContain("no-store");
    expect(guestHost.status).toBe(200);
    expect(guestHost.headers.get("cache-control")).toContain("no-store");
  });

  it("uses CSP instead of X-Frame-Options for cross-host preview embedding", () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "production");
    configureProductionHosts();

    const response = proxy(
      request(
        "https://niskalastudio.site/id/preview/dark-cinematic",
        "niskalastudio.site",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-frame-options")).toBeNull();
    expect(response.headers.get("content-security-policy")).toContain(
      "https://client.niskalastudio.site",
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "https://staff.niskalastudio.site",
    );
  });
});

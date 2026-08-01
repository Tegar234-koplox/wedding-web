import { afterEach, describe, expect, it, vi } from "vitest";

import {
  configuredHosts,
  isAllowedHostForZone,
  normalizeHost,
  sensitiveRouteForRequest,
  trustZoneForPath,
} from "./trust-zones";

afterEach(() => {
  vi.unstubAllEnvs();
});

function configureProductionHosts() {
  vi.stubEnv(
    "NISKALA_PUBLIC_HOSTS",
    "niskalastudio.site,www.niskalastudio.site",
  );
  vi.stubEnv("NISKALA_CLIENT_HOSTS", "client.niskalastudio.site");
  vi.stubEnv("NISKALA_STAFF_HOSTS", "staff.niskalastudio.site");
}

describe("trust zones", () => {
  it("maps staff, client, public, and shared paths", () => {
    expect(trustZoneForPath("/admin/orders/N001")).toBe("staff");
    expect(trustZoneForPath("/api/staff/auth/me")).toBe("staff");
    expect(trustZoneForPath("/guest-delivery/token/guests")).toBe("client");
    expect(trustZoneForPath("/api/guest-management/token")).toBe("client");
    expect(trustZoneForPath("/api/client/bootstrap")).toBe("client");
    expect(trustZoneForPath("/api/guest/redeem")).toBe("public");
    expect(trustZoneForPath("/id/themes")).toBe("public");
    expect(trustZoneForPath("/_next/static/chunk.js")).toBe("shared");
  });

  it("uses disjoint production hosts and rejects the Vercel default host", () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "production");
    configureProductionHosts();

    expect(isAllowedHostForZone("niskalastudio.site", "public")).toBe(true);
    expect(isAllowedHostForZone("niskalastudio.site", "staff")).toBe(false);
    expect(isAllowedHostForZone("staff.niskalastudio.site", "staff")).toBe(true);
    expect(isAllowedHostForZone("client.niskalastudio.site", "client")).toBe(true);
    expect(isAllowedHostForZone("wedding-web.vercel.app", "public")).toBe(false);
  });

  it("accepts environment-specific staging hosts", () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "staging");
    vi.stubEnv("NISKALA_PUBLIC_HOSTS", "staging.niskalastudio.site");
    vi.stubEnv("NISKALA_CLIENT_HOSTS", "client-staging.niskalastudio.site");
    vi.stubEnv("NISKALA_STAFF_HOSTS", "staff-staging.niskalastudio.site");

    expect(configuredHosts("public")).toContain("staging.niskalastudio.site");
    expect(
      isAllowedHostForZone("client-staging.niskalastudio.site", "client"),
    ).toBe(true);
    expect(
      isAllowedHostForZone("staging.niskalastudio.site", "client"),
    ).toBe(false);
  });

  it("classifies tokenized invitations and previews as sensitive", () => {
    expect(
      sensitiveRouteForRequest(
        "/id/i/n001",
        new URLSearchParams("guest=secret"),
      ),
    ).toBe("guest");
    expect(
      sensitiveRouteForRequest(
        "/id/i/n001",
        new URLSearchParams("preview=secret"),
      ),
    ).toBe("preview");
    expect(
      sensitiveRouteForRequest(
        "/id/i/n001/wishes",
        new URLSearchParams("access=legacy-secret"),
      ),
    ).toBe("client");
    expect(
      sensitiveRouteForRequest(
        "/id/preview/dark-cinematic",
        new URLSearchParams(),
      ),
    ).toBe("preview");
    expect(
      sensitiveRouteForRequest("/id/i/n001", new URLSearchParams()),
    ).toBeNull();
    expect(
      sensitiveRouteForRequest("/api/guest/redeem", new URLSearchParams()),
    ).toBe("guest");
    expect(
      sensitiveRouteForRequest("/g", new URLSearchParams()),
    ).toBe("guest");
    expect(
      sensitiveRouteForRequest("/preview/access", new URLSearchParams()),
    ).toBe("preview");
    expect(
      sensitiveRouteForRequest(
        "/api/preview/redeem",
        new URLSearchParams(),
      ),
    ).toBe("preview");
  });

  it("normalizes host ports and rejects malformed host headers", () => {
    expect(normalizeHost("Staff.NiskalaStudio.Site:443")).toBe(
      "staff.niskalastudio.site",
    );
    expect(normalizeHost("bad.example/path")).toBeNull();
    expect(normalizeHost("attacker@staff.niskalastudio.site")).toBeNull();
    expect(
      normalizeHost("bad.example\r\nx-forwarded-host: attacker.test"),
    ).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCloudflareAccessHeaders } from "./cloudflare-access";

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.CF_ACCESS_CLIENT_ID;
  delete process.env.CF_ACCESS_CLIENT_SECRET;
  delete process.env.NISKALA_BFF_SHARED_SECRET;
});

describe("Cloudflare Access service credentials", () => {
  it("allows an unprotected local or staging API when no pair is configured", () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "development");
    expect(getCloudflareAccessHeaders()).toEqual({});
  });

  it("fails closed in production when the pair is missing", () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "production");
    expect(getCloudflareAccessHeaders()).toBeNull();
  });

  it("returns only a complete normalized credential pair", () => {
    process.env.NISKALA_BFF_SHARED_SECRET =
      "Bff-2026!Az3#Km7$Np2%Qr5&St8*Vx1";
    process.env.CF_ACCESS_CLIENT_ID =
      "CF-Access-Client-Id: production.access";
    process.env.CF_ACCESS_CLIENT_SECRET =
      "CF-Access-Client-Secret: server-only-secret";

    expect(getCloudflareAccessHeaders()).toEqual({
      "CF-Access-Client-Id": "production.access",
      "CF-Access-Client-Secret": "server-only-secret",
      "X-Niskala-BFF-Secret": "Bff-2026!Az3#Km7$Np2%Qr5&St8*Vx1",
    });
  });

  it("rejects a configured weak or placeholder BFF secret", () => {
    process.env.NISKALA_BFF_SHARED_SECRET = "change-me-change-me-change-me-change-me";

    expect(getCloudflareAccessHeaders()).toBeNull();
  });
});

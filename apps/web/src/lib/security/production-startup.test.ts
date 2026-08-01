import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assertProductionSecurityEnvironment } from "./production-startup";

afterEach(() => {
  vi.unstubAllEnvs();
});

function configureValidProductionEnvironment() {
  vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "production");
  vi.stubEnv("CF_ACCESS_CLIENT_ID", "production.access");
  vi.stubEnv("CF_ACCESS_CLIENT_SECRET", "server-only-secret");
  vi.stubEnv(
    "NISKALA_BFF_SHARED_SECRET",
    "Bff-2026!Az3#Km7$Np2%Qr5&St8*Vx1",
  );
  vi.stubEnv(
    "NISKALA_PUBLIC_HOSTS",
    "niskalastudio.site,www.niskalastudio.site",
  );
  vi.stubEnv("NISKALA_CLIENT_HOSTS", "client.niskalastudio.site");
  vi.stubEnv("NISKALA_STAFF_HOSTS", "staff.niskalastudio.site");
  vi.stubEnv("NISKALA_API_HOSTS", "api.niskalastudio.site");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://niskalastudio.site");
  vi.stubEnv("API_URL", "https://api.niskalastudio.site/api/v1");
}

describe("production startup security validation", () => {
  it("does not require production controls in local development", () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "development");

    expect(() => assertProductionSecurityEnvironment()).not.toThrow();
  });

  it("accepts an explicit, disjoint production configuration", () => {
    configureValidProductionEnvironment();

    expect(() => assertProductionSecurityEnvironment()).not.toThrow();
  });

  it("fails startup when Cloudflare service credentials are absent", () => {
    configureValidProductionEnvironment();
    vi.stubEnv("CF_ACCESS_CLIENT_SECRET", "");

    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "Cloudflare Access service credentials",
    );
  });

  it("fails startup when the BFF origin secret is missing or weak", () => {
    configureValidProductionEnvironment();
    vi.stubEnv("NISKALA_BFF_SHARED_SECRET", "");
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "NISKALA_BFF_SHARED_SECRET",
    );

    vi.stubEnv(
      "NISKALA_BFF_SHARED_SECRET",
      "change-me-change-me-change-me-change-me",
    );
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "NISKALA_BFF_SHARED_SECRET",
    );
  });

  it("fails startup when a host list is missing or contains a wildcard", () => {
    configureValidProductionEnvironment();
    vi.stubEnv("NISKALA_CLIENT_HOSTS", "");
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "NISKALA_CLIENT_HOSTS must be explicitly configured",
    );

    vi.stubEnv("NISKALA_CLIENT_HOSTS", "*.niskalastudio.site");
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "invalid production host",
    );
  });

  it("fails startup for Vercel default hosts and cross-zone overlap", () => {
    configureValidProductionEnvironment();
    vi.stubEnv("NISKALA_STAFF_HOSTS", "wedding-web.vercel.app");
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "invalid production host",
    );

    vi.stubEnv("NISKALA_STAFF_HOSTS", "client.niskalastudio.site");
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "assigned to both client and staff",
    );
  });

  it("binds the API URL to an explicit, disjoint API host allowlist", () => {
    configureValidProductionEnvironment();
    vi.stubEnv("NISKALA_API_HOSTS", "");
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "NISKALA_API_HOSTS must be explicitly configured",
    );

    vi.stubEnv("NISKALA_API_HOSTS", "api.wedding-web.vercel.app");
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "invalid production host",
    );

    vi.stubEnv("NISKALA_API_HOSTS", "client.niskalastudio.site");
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "assigned to both client and api",
    );

    vi.stubEnv("NISKALA_API_HOSTS", "api.niskalastudio.site");
    vi.stubEnv("API_URL", "https://unexpected-api.example/api/v1");
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "must use a host from NISKALA_API_HOSTS",
    );

    vi.stubEnv("API_URL", "https://api.niskalastudio.site:8443/api/v1");
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "API_URL must be a valid HTTPS URL",
    );
  });

  it("requires HTTPS URLs and binds the public URL to the public zone", () => {
    configureValidProductionEnvironment();
    vi.stubEnv("API_URL", "http://api.niskalastudio.site/api/v1");
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "API_URL must be a valid HTTPS URL",
    );

    vi.stubEnv("API_URL", "https://api.niskalastudio.site/api");
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "API_URL must end with /api/v1",
    );

    vi.stubEnv("API_URL", "https://api.niskalastudio.site/api/v1");
    vi.stubEnv(
      "NEXT_PUBLIC_SITE_URL",
      "https://client.niskalastudio.site",
    );
    expect(() => assertProductionSecurityEnvironment()).toThrow(
      "must use a host from NISKALA_PUBLIC_HOSTS",
    );
  });
});

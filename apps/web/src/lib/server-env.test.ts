import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("server environment", () => {
  it("accepts the legacy public API variable only outside production", async () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "development");
    vi.stubEnv("API_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://legacy-api.example/api/v1");

    const { serverEnv } = await import("./server-env");

    expect(serverEnv.API_URL).toBe("https://legacy-api.example/api/v1");
  });

  it("requires the server-only API variable in production", async () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "production");
    vi.stubEnv("API_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://must-not-be-used.example/api/v1");

    await expect(import("./server-env")).rejects.toThrow();
  });

  it("accepts an explicit server-only production API URL", async () => {
    vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "production");
    vi.stubEnv("API_URL", "https://api.niskalastudio.site/api/v1");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");

    const { serverEnv } = await import("./server-env");

    expect(serverEnv.API_URL).toBe(
      "https://api.niskalastudio.site/api/v1",
    );
  });
});

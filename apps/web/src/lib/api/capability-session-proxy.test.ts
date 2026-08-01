import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-env", () => ({
  serverEnv: {
    API_URL: "https://api.example.test/api/v1",
  },
}));

import { proxyCapabilitySessionRequest } from "./capability-session-proxy";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CF_ACCESS_CLIENT_ID;
  delete process.env.CF_ACCESS_CLIENT_SECRET;
});

describe("proxyCapabilitySessionRequest", () => {
  it("forwards only allowlisted preview cookies in both directions", async () => {
    process.env.CF_ACCESS_CLIENT_ID = "preview-client-id";
    process.env.CF_ACCESS_CLIENT_SECRET = "preview-client-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { redirect_to: "/id/i/preview" },
        {
          headers: {
            "Set-Cookie":
              "__Host-niskala_preview=upstream-session; Path=/; HttpOnly; Secure; SameSite=Strict",
          },
        },
      ),
    );
    const request = new Request(
      "https://niskalastudio.site/api/preview/redeem",
      {
        body: JSON.stringify({ token: "grant-token" }),
        headers: {
          Cookie:
            "unrelated=drop-me; __Host-niskala_preview=browser-session",
          "Content-Type": "application/json",
          Origin: "https://niskalastudio.site",
          "Sec-Fetch-Site": "same-origin",
        },
        method: "POST",
      },
    );

    const response = await proxyCapabilitySessionRequest(request, [
      "access",
      "preview",
      "redeem",
    ]);

    const [, options] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(options?.headers);
    expect(headers.get("cookie")).toBe(
      "__Host-niskala_preview=browser-session",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "__Host-niskala_preview=upstream-session",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

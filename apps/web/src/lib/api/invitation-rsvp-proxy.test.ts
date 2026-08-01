import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-env", () => ({
  serverEnv: {
    API_URL: "https://api.example.test/api/v1",
  },
}));

import { proxyInvitationRsvpRequest } from "./invitation-rsvp-proxy";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CF_ACCESS_CLIENT_ID;
  delete process.env.CF_ACCESS_CLIENT_SECRET;
});

describe("proxyInvitationRsvpRequest", () => {
  it("submits RSVP through the server-only Access token", async () => {
    process.env.CF_ACCESS_CLIENT_ID = "vercel-staging.access";
    process.env.CF_ACCESS_CLIENT_SECRET = "server-only-secret";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ status: "accepted" }));
    const request = new Request(
      "https://staging.example.test/api/invitations/n001/rsvp",
      {
        body: JSON.stringify({ token: "guest-token", rsvp_status: "accepted" }),
        headers: {
          Authorization: "must-not-be-forwarded",
          Cookie: "must-not-be-forwarded",
          "Content-Type": "application/json",
          Origin: "https://staging.example.test",
          "Sec-Fetch-Site": "same-origin",
        },
        method: "POST",
      },
    );

    const response = await proxyInvitationRsvpRequest(request, "n001");

    const [url, options] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(options?.headers);
    expect(url?.toString()).toBe(
      "https://api.example.test/api/v1/invitations/n001/rsvp",
    );
    expect(options?.method).toBe("POST");
    expect(headers.get("cf-access-client-id")).toBe("vercel-staging.access");
    expect(headers.get("cf-access-client-secret")).toBe("server-only-secret");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("rejects cross-site and oversized RSVP writes", async () => {
    process.env.CF_ACCESS_CLIENT_ID = "vercel-staging.access";
    process.env.CF_ACCESS_CLIENT_SECRET = "server-only-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const crossSite = await proxyInvitationRsvpRequest(
      new Request("https://staging.example.test/api/invitations/n001/rsvp", {
        body: "{}",
        headers: {
          Origin: "https://staging.example.test",
          "Sec-Fetch-Site": "cross-site",
        },
        method: "POST",
      }),
      "n001",
    );
    expect(crossSite.status).toBe(403);

    const oversized = await proxyInvitationRsvpRequest(
      new Request("https://staging.example.test/api/invitations/n001/rsvp", {
        body: "x",
        headers: {
          "Content-Length": String(16 * 1024 + 1),
          Origin: "https://staging.example.test",
          "Sec-Fetch-Site": "same-origin",
        },
        method: "POST",
      }),
      "n001",
    );
    expect(oversized.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

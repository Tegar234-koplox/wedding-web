import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_API_URL: "https://api.example.test/api/v1",
    NEXT_PUBLIC_SITE_URL: "https://staging.example.test",
  },
}));

import { proxyStaffRequest } from "./staff-proxy";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CF_ACCESS_CLIENT_ID;
  delete process.env.CF_ACCESS_CLIENT_SECRET;
});

function configureAccessToken() {
  process.env.CF_ACCESS_CLIENT_ID = "vercel-staging.access";
  process.env.CF_ACCESS_CLIENT_SECRET = "server-only-secret";
}

describe("proxyStaffRequest", () => {
  it("forwards CSRF requests through Cloudflare and returns only Django cookies", async () => {
    configureAccessToken();
    const upstreamHeaders = new Headers();
    upstreamHeaders.append("Content-Type", "application/json");
    upstreamHeaders.append("Set-Cookie", "csrftoken=csrf-value; Path=/; Secure; HttpOnly");
    upstreamHeaders.append("Set-Cookie", "CF_Authorization=must-not-reach-browser; Path=/");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ csrfToken: "csrf-value" }), {
        headers: upstreamHeaders,
      }),
    );

    const response = await proxyStaffRequest(
      new Request("https://staging.example.test/api/staff/auth/csrf"),
      ["auth", "csrf"],
    );

    const [url, options] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(options?.headers);
    expect(url?.toString()).toBe("https://api.example.test/api/v1/auth/csrf");
    expect(headers.get("cf-access-client-id")).toBe("vercel-staging.access");
    expect(headers.get("cf-access-client-secret")).toBe("server-only-secret");
    expect(headers.get("origin")).toBe("https://staging.example.test");
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("csrftoken=csrf-value");
    expect(response.headers.get("set-cookie")).not.toContain("CF_Authorization");
  });

  it("forwards the staff session, CSRF header, query, and JSON body", async () => {
    configureAccessToken();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: { username: "staff" } }), {
        headers: [
          ["Content-Type", "application/json"],
          ["Set-Cookie", "sessionid=session-value; Path=/; Secure; HttpOnly"],
        ],
      }),
    );
    const request = new Request(
      "https://staging.example.test/api/staff/admin/orders?page=2",
      {
        body: JSON.stringify({ status: "published" }),
        headers: {
          Authorization: "must-not-be-forwarded",
          Cookie: "csrftoken=csrf-value; sessionid=session-value",
          "Content-Type": "application/json",
          "X-CSRFToken": "csrf-value",
        },
        method: "PATCH",
      },
    );

    const response = await proxyStaffRequest(request, ["admin", "orders"]);

    const [url, options] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(options?.headers);
    expect(url?.toString()).toBe("https://api.example.test/api/v1/admin/orders?page=2");
    expect(options?.method).toBe("PATCH");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toContain("sessionid=session-value");
    expect(headers.get("x-csrftoken")).toBe("csrf-value");
    expect(new TextDecoder().decode(options?.body as ArrayBuffer)).toBe(
      '{"status":"published"}',
    );
    expect(response.headers.get("set-cookie")).toContain("sessionid=session-value");
  });

  it("rejects paths outside the staff allowlist without contacting upstream", async () => {
    configureAccessToken();
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await proxyStaffRequest(
      new Request("https://staging.example.test/api/staff/invitations/n001"),
      ["invitations", "n001"],
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed for incomplete Access credentials and login redirects", async () => {
    process.env.CF_ACCESS_CLIENT_ID = "orphaned-client-id";
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const unconfigured = await proxyStaffRequest(
      new Request("https://staging.example.test/api/staff/auth/me"),
      ["auth", "me"],
    );
    expect(unconfigured.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();

    configureAccessToken();
    fetchMock.mockResolvedValue(
      new Response(null, {
        headers: { Location: "https://team.cloudflareaccess.com/login" },
        status: 302,
      }),
    );
    const redirected = await proxyStaffRequest(
      new Request("https://staging.example.test/api/staff/auth/me"),
      ["auth", "me"],
    );
    expect(redirected.status).toBe(502);
    expect(redirected.headers.get("location")).toBeNull();
  });
});

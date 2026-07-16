import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_API_URL: "https://api.example.test/api/v1",
    NEXT_PUBLIC_SITE_URL: "https://staging.example.test",
  },
}));

import { proxyGuestManagementRequest } from "./guest-management-proxy";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CF_ACCESS_CLIENT_ID;
  delete process.env.CF_ACCESS_CLIENT_SECRET;
});

function configureAccessToken() {
  process.env.CF_ACCESS_CLIENT_ID = "vercel-staging.access";
  process.env.CF_ACCESS_CLIENT_SECRET = "server-only-secret";
}

describe("proxyGuestManagementRequest", () => {
  it("forwards guest-management requests with the server-only Access token", async () => {
    configureAccessToken();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([{ display_name: "Tamu" }], {
        headers: { "Cache-Control": "no-store" },
      }),
    );
    const request = new Request(
      "https://staging.example.test/api/guest-management/token/guest-links?dry_run=true",
      { headers: { Accept: "application/json" } },
    );

    const response = await proxyGuestManagementRequest(request, "invite%3An001", [
      "guest-links",
    ]);

    const [url, options] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(options?.headers);
    expect(url?.toString()).toBe(
      "https://api.example.test/api/v1/guest-management/invite%3An001/guest-links?dry_run=true",
    );
    expect(headers.get("cf-access-client-id")).toBe("vercel-staging.access");
    expect(headers.get("cf-access-client-secret")).toBe("server-only-secret");
    expect(headers.get("origin")).toBe("https://staging.example.test");
    expect(options?.method).toBe("GET");
    expect(options?.redirect).toBe("manual");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("normalizes complete Access header lines copied from Cloudflare", async () => {
    process.env.CF_ACCESS_CLIENT_ID =
      "CF-Access-Client-Id: vercel-staging.access";
    process.env.CF_ACCESS_CLIENT_SECRET =
      "CF-Access-Client-Secret: server-only-secret";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ public_slug: "n001" }));
    const request = new Request(
      "https://staging.example.test/api/guest-management/token",
    );

    const response = await proxyGuestManagementRequest(request, "invite-token");

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(response.status).toBe(200);
    expect(headers.get("cf-access-client-id")).toBe("vercel-staging.access");
    expect(headers.get("cf-access-client-secret")).toBe("server-only-secret");
  });

  it("forwards JSON write bodies without forwarding browser credentials", async () => {
    configureAccessToken();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ delivery_status: "sent" }));
    const request = new Request(
      "https://staging.example.test/api/guest-management/token/guest-links/id/delivery",
      {
        body: JSON.stringify({ sent: true }),
        headers: {
          Authorization: "browser-credential-must-not-be-forwarded",
          "Content-Type": "application/json",
          Cookie: "browser-cookie-must-not-be-forwarded",
        },
        method: "PATCH",
      },
    );

    await proxyGuestManagementRequest(request, "invite-token", [
      "guest-links",
      "id",
      "delivery",
    ]);

    const options = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(options?.headers);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("origin")).toBe("https://staging.example.test");
    expect(new TextDecoder().decode(options?.body as ArrayBuffer)).toBe('{"sent":true}');
  });

  it("preserves multipart uploads and their boundary", async () => {
    configureAccessToken();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ summary: { created_count: 1 } }));
    const request = new Request(
      "https://staging.example.test/api/guest-management/token/guest-links/import?dry_run=true",
      {
        body: "--vitest-boundary\r\nCSV payload\r\n--vitest-boundary--",
        headers: { "Content-Type": "multipart/form-data; boundary=vitest-boundary" },
        method: "POST",
      },
    );

    await proxyGuestManagementRequest(request, "invite-token", [
      "guest-links",
      "import",
    ]);

    const options = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(options?.headers);
    expect(headers.get("content-type")).toBe(
      "multipart/form-data; boundary=vitest-boundary",
    );
    expect((options?.body as ArrayBuffer).byteLength).toBeGreaterThan(0);
  });

  it("preserves safe CSV download headers and strips upstream credentials", async () => {
    configureAccessToken();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("name\nTamu", {
        headers: {
          "CF-Access-Client-Secret": "must-not-reach-browser",
          "Content-Disposition": 'attachment; filename="guests.csv"',
          "Content-Type": "text/csv",
        },
      }),
    );
    const request = new Request(
      "https://staging.example.test/api/guest-management/token/guest-links/export",
      { headers: { Accept: "*/*" } },
    );

    const response = await proxyGuestManagementRequest(request, "invite-token", [
      "guest-links",
      "export",
    ]);

    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="guests.csv"',
    );
    expect(response.headers.get("content-type")).toBe("text/csv");
    expect(response.headers.get("cf-access-client-secret")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("works without Access credentials for an unprotected local API", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ public_slug: "n001" }));
    const request = new Request("https://staging.example.test/api/guest-management/token");

    const response = await proxyGuestManagementRequest(request, "invite-token");

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(response.status).toBe(200);
    expect(headers.get("cf-access-client-id")).toBeNull();
    expect(headers.get("cf-access-client-secret")).toBeNull();
  });

  it("fails closed when the Access credential pair is incomplete", async () => {
    process.env.CF_ACCESS_CLIENT_ID = "orphaned-client-id";
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const request = new Request("https://staging.example.test/api/guest-management/token");

    const response = await proxyGuestManagementRequest(request, "invite-token");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: { message: "Guest management service is not configured." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not expose an Access login redirect to the browser", async () => {
    configureAccessToken();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        headers: { Location: "https://team.cloudflareaccess.com/login" },
        status: 302,
      }),
    );
    const request = new Request("https://staging.example.test/api/guest-management/token");

    const response = await proxyGuestManagementRequest(request, "invite-token");

    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
  });
});

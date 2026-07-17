import { getSampleInvitation } from "@/invitations/samples";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_API_URL: "https://api.example.test/api/v1",
  },
}));

import { fetchPublicInvitation } from "./public";

const invitationPayload = {
  ...getSampleInvitation("elegant-classic", "id"),
  audio: null,
  cover: null,
  events: [],
  guest: null,
  package_code: "signature",
  public_slug: "alya-raka",
  published_at: "2026-07-15T00:00:00Z",
  theme_slug: "elegant-classic",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete process.env.CF_ACCESS_CLIENT_ID;
  delete process.env.CF_ACCESS_CLIENT_SECRET;
});

describe("fetchPublicInvitation", () => {
  it("returns null only when the API responds with 404", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 404 }));

    await expect(fetchPublicInvitation("missing")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries one transient 5xx response before returning the invitation", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(invitationPayload));

    const result = fetchPublicInvitation("alya-raka");
    await vi.runAllTimersAsync();

    await expect(result).resolves.toMatchObject({ public_slug: "alya-raka" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propagates a persistent API failure instead of returning a false 404", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 502 }),
    );

    const assertion = expect(fetchPublicInvitation("alya-raka")).rejects.toThrow(
      "Public API request failed with 502",
    );
    await vi.runAllTimersAsync();

    await assertion;
  });

  it("disables caching for personalized guest links", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(invitationPayload));

    await fetchPublicInvitation("alya-raka", undefined, "guest-token");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("guest=guest-token"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("authenticates server-side requests to a Cloudflare Access protected API", async () => {
    process.env.CF_ACCESS_CLIENT_ID = "staging-web-client-id";
    process.env.CF_ACCESS_CLIENT_SECRET = "staging-web-client-secret";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(invitationPayload));

    await fetchPublicInvitation("alya-raka", undefined, "guest-token");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("guest=guest-token"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "CF-Access-Client-Id": "staging-web-client-id",
          "CF-Access-Client-Secret": "staging-web-client-secret",
        }),
      }),
    );
  });

  it("normalizes complete Access header lines copied from Cloudflare", async () => {
    process.env.CF_ACCESS_CLIENT_ID =
      "CF-Access-Client-Id: staging-web-client-id";
    process.env.CF_ACCESS_CLIENT_SECRET =
      "CF-Access-Client-Secret: staging-web-client-secret";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(invitationPayload));

    await fetchPublicInvitation("alya-raka", undefined, "guest-token");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("guest=guest-token"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "CF-Access-Client-Id": "staging-web-client-id",
          "CF-Access-Client-Secret": "staging-web-client-secret",
        }),
      }),
    );
  });

  it("rejects an incomplete Cloudflare Access credential pair", async () => {
    process.env.CF_ACCESS_CLIENT_ID = "staging-web-client-id";
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(fetchPublicInvitation("alya-raka")).rejects.toThrow(
      "CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET must be configured together",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

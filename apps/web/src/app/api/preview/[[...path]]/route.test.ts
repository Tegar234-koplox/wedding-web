import { beforeEach, describe, expect, it, vi } from "vitest";

const proxyRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/capability-session-proxy", () => ({
  proxyCapabilitySessionRequest: proxyRequest,
}));

import { POST } from "./route";

beforeEach(() => {
  proxyRequest.mockReset();
  proxyRequest.mockResolvedValue(Response.json({ ok: true }));
});

describe("preview access BFF", () => {
  it.each(["redeem", "logout"])(
    "allows the %s action and maps it to the preview access endpoint",
    async (action) => {
      const request = new Request(
        `https://niskalastudio.site/api/preview/${action}`,
        { method: "POST" },
      );

      const response = await POST(request, {
        params: Promise.resolve({ path: [action] }),
      });

      expect(response.status).toBe(200);
      expect(proxyRequest).toHaveBeenCalledWith(request, [
        "access",
        "preview",
        action,
      ]);
    },
  );

  it("rejects every path outside the explicit allowlist", async () => {
    const response = await POST(
      new Request("https://niskalastudio.site/api/preview/redeem/extra", {
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["redeem", "extra"] }) },
    );

    expect(response.status).toBe(404);
    expect(proxyRequest).not.toHaveBeenCalled();
  });
});

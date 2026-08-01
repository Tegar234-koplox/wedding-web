import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { filterCookieHeader } from "./proxy-security";

describe("proxy security helpers", () => {
  it("filters cookies case-insensitively and drops duplicate or unrelated cookies", () => {
    const allowed = new Set(["__Host-niskala_client", "csrftoken"]);

    expect(
      filterCookieHeader(
        "__Host-niskala_client=session; analytics=drop; csrftoken=csrf; __Host-niskala_client=duplicate",
        allowed,
      ),
    ).toBe("__Host-niskala_client=session; csrftoken=csrf");
  });
});

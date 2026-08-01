import { describe, expect, it } from "vitest";

import { backendPath } from "./route";

describe("client BFF path allowlist", () => {
  it("allows only the explicit portal and capability route shapes", () => {
    const guestId = "123e4567-e89b-42d3-a456-426614174000";

    expect(backendPath(["portal"])).toEqual(["client", "portal"]);
    expect(backendPath(["portal", "guest-links", guestId, "rotate"])).toEqual([
      "client",
      "portal",
      "guest-links",
      guestId,
      "rotate",
    ]);
    expect(backendPath(["login", guestId])).toEqual([
      "access",
      "client",
      "login",
      guestId,
    ]);
  });

  it("rejects dot segments, encoded separators, and unlisted portal tails", () => {
    expect(backendPath(["portal", ".."]))
      .toBeNull();
    expect(backendPath(["portal", "admin"]))
      .toBeNull();
    expect(backendPath(["portal", "guest-links", "not-a-uuid", "rotate"]))
      .toBeNull();
    expect(backendPath(["portal", "guest-links/rotate"]))
      .toBeNull();
  });
});

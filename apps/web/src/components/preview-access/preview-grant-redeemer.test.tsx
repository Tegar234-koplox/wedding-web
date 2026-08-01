import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));
const grant = vi.hoisted(() => ({
  consume: vi.fn(),
  token: "preview-grant",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));
vi.mock("@/lib/use-grant-fragment", () => ({
  consumeGrantFragment: grant.consume,
  useGrantFragment: () => grant.token,
}));

import { PreviewGrantRedeemer } from "./preview-grant-redeemer";

afterEach(() => {
  cleanup();
  navigation.refresh.mockClear();
  navigation.replace.mockClear();
  grant.token = "preview-grant";
  grant.consume.mockReset();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("PreviewGrantRedeemer", () => {
  it("redeems the fragment once and replaces it with an internal invitation path", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        csrf_token: "preview-csrf",
        redirect_to: "https://canonical.example.test/id/i/access-id",
      }),
    );

    render(<PreviewGrantRedeemer />);

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/id/i/access-id");
    });
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
    expect(grant.consume).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem("niskala-preview-csrf")).toBe(
      "preview-csrf",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/preview/redeem",
      expect.objectContaining({
        body: JSON.stringify({ token: "preview-grant" }),
        credentials: "same-origin",
        method: "POST",
      }),
    );
  });

  it("does not call redemption without a fragment grant", () => {
    grant.token = "";
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(<PreviewGrantRedeemer />);

    expect(screen.getByText("Preview tidak tersedia.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

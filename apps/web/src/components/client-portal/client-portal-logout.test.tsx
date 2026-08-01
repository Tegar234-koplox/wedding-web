import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

import { ClientPortalLogout } from "./client-portal-logout";

afterEach(() => {
  cleanup();
  navigation.refresh.mockReset();
  navigation.replace.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("ClientPortalLogout", () => {
  it("revokes the session, clears browser state, and returns to login", async () => {
    const accessId = "123e4567-e89b-42d3-a456-426614174000";
    window.sessionStorage.setItem("niskala-client-csrf", "csrf-value");
    window.localStorage.setItem("niskala-client-access-id", accessId);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    render(<ClientPortalLogout />);
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        `/client/login/${accessId}`,
      );
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/client/logout",
      expect.objectContaining({
        credentials: "same-origin",
        headers: expect.objectContaining({ "X-CSRFToken": "csrf-value" }),
        method: "POST",
      }),
    );
    expect(window.sessionStorage.getItem("niskala-client-csrf")).toBeNull();
    expect(window.localStorage.getItem("niskala-client-access-id")).toBeNull();
  });
});

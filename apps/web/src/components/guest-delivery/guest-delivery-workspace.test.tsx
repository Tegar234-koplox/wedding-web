import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/site/niskala-preloader", () => ({
  NetworkAwarePreloader: () => null,
  NiskalaPreloader: () => null,
}));

import { GuestDeliveryWorkspace } from "./guest-delivery-workspace";

const essentialDetail = {
  token: "essential-token",
  invitation: {
    public_slug: "surya-fika",
    status: "published",
    approval_status: "published",
    couple_name: "Surya & Fika",
    theme_name: "Elegant Classic",
    package_name: "Essential",
    package_code: "essential",
  },
  capabilities: {
    rsvp: false,
    guest_wishes: false,
  },
  rsvp: {
    total_invited: 0,
    total_confirmed: 0,
    total_declined: 0,
    response_rate: 0,
  },
  delivery: {
    total_guests: 0,
    sent_count: 0,
    not_sent_count: 0,
  },
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function stubEssentialGuestManagement() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/guest-links")) {
      return jsonResponse([]);
    }
    if (url.endsWith("/essential-token")) {
      return jsonResponse(essentialDetail);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Essential guest delivery", () => {
  it("hides RSVP and wishes while keeping the corrected CSV guide", async () => {
    const fetchMock = stubEssentialGuestManagement();

    render(<GuestDeliveryWorkspace mode="import" token="essential-token" />);

    expect(await screen.findByText("Surya & Fika")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Ucapan Tamu" })).toBeNull();
    expect(screen.queryByText("RSVP Hadir")).toBeNull();
    expect(
      screen.getByText("1. Download template CSV dari tombol di bawah."),
    ).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).endsWith("/wishes")),
    ).toBe(false);
  });

  it("removes the RSVP column from the personal-link list", async () => {
    stubEssentialGuestManagement();

    render(<GuestDeliveryWorkspace mode="list" token="essential-token" />);

    expect(await screen.findByText("Surya & Fika")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("columnheader", { name: "RSVP" })).toBeNull();
    });
  });
});

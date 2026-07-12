import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { getPremiumVisualConfig } from "./presentation";
import { RendererV2 } from "./renderer-v2";
import { getSampleInvitation } from "./samples";
import { shouldAnimatePremium } from "./theme-ornament";

beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => cleanup());

describe("renderer v2 invitation experience", () => {
  it("keeps the invitation behind a cover until the guest opens it", () => {
    render(
      <RendererV2
        invitation={getSampleInvitation("elegant-classic", "id")}
        packageCode="signature"
      />,
    );

    const openButton = screen.getByRole("button", {
      name: "Buka Undangan",
    });
    expect(openButton).toBeTruthy();

    fireEvent.click(openButton);

    expect(screen.getByText("Waktu & Tempat")).toBeTruthy();
  });

  it("shows the invited guest name on the cover when a guest link is used", () => {
    render(
      <RendererV2
        invitation={{
          ...getSampleInvitation("elegant-classic", "id"),
          guest: { displayName: "Syarif" },
        }}
        packageCode="signature"
      />,
    );

    expect(screen.getByText("Untuk Syarif")).toBeTruthy();
  });

  it("does not render a music control when no licensed audio exists", () => {
    render(
      <RendererV2
        invitation={getSampleInvitation("dark-cinematic", "en")}
        packageCode="couture"
      />,
    );

    expect(screen.queryByLabelText(/^Play /)).toBeNull();
  });

  it("starts music after opening and pauses it when the page is hidden", async () => {
    const play = vi.mocked(HTMLMediaElement.prototype.play);
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);

    render(
      <RendererV2
        audio={{
          default_volume: 0.55,
          loop: true,
          secure_url: "https://res.cloudinary.com/demo/video/upload/song.mp3",
          title: "Wedding music",
        }}
        invitation={getSampleInvitation("islamic-soft", "id")}
        packageCode="signature"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));
    await waitFor(() => expect(play).toHaveBeenCalled());

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(pause).toHaveBeenCalled();
  });

  it("keeps premium decoration non-interactive and exposes it after opening", () => {
    const { container } = render(
      <RendererV2
        invitation={getSampleInvitation("luxury-gold", "id")}
        packageCode="signature"
      />,
    );

    const coverDecoration = container.querySelector(
      '[data-decoration-layer="cover"]',
    );
    expect(coverDecoration?.getAttribute("aria-hidden")).toBe("true");
    expect(coverDecoration?.className).toContain("pointer-events-none");

    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));

    const sectionDecorations = container.querySelectorAll(
      '[data-decoration-layer="section"]',
    );
    expect(sectionDecorations.length).toBe(13);
    sectionDecorations.forEach((decoration) => {
      expect(decoration.getAttribute("aria-hidden")).toBe("true");
      expect(decoration.className).toContain("pointer-events-none");
    });
    expect(
      container.querySelectorAll('[data-decoration-layer="section-overlay"]')
        .length,
    ).toBe(0);
    expect(
      container.querySelectorAll('[data-decoration-layer="section-corners"]')
        .length,
    ).toBe(13);
  });

  it("animates the premium cover overlay for Signature", () => {
    const { container } = render(
      <RendererV2
        invitation={getSampleInvitation("luxury-gold", "id")}
        packageCode="signature"
      />,
    );

    expect(
      container
        .querySelector('[data-decoration-layer="cover-overlay"]')
        ?.getAttribute("data-animated"),
    ).toBe("true");
  });

  it("renders overlay and corners on every Couture section", () => {
    const { container } = render(
      <RendererV2
        invitation={getSampleInvitation("dark-cinematic", "id")}
        packageCode="couture"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));

    expect(
      container.querySelectorAll('[data-decoration-layer="section"]').length,
    ).toBe(16);
    expect(
      container.querySelectorAll('[data-decoration-layer="section-overlay"]')
        .length,
    ).toBe(16);
    expect(
      container.querySelectorAll('[data-decoration-layer="section-corners"]')
        .length,
    ).toBe(16);
  });

  it("does not add premium decoration to Essential", () => {
    const { container } = render(
      <RendererV2
        invitation={getSampleInvitation("elegant-classic", "id")}
        packageCode="essential"
      />,
    );

    expect(
      container.querySelector('[data-decoration-layer="cover"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-decoration-layer="text-contrast"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-decoration-layer="cover-overlay"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-decoration-layer="cover-corners"]'),
    ).toBeNull();
  });

  it("applies the package card treatment to Essential, Signature, and Couture", () => {
    const essential = render(
      <RendererV2
        invitation={getSampleInvitation("elegant-classic", "id")}
        packageCode="essential"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));
    expect(
      essential.container.querySelectorAll(
        '[data-invitation-card="essential"]',
      ).length,
    ).toBeGreaterThan(0);
    essential.unmount();

    const signature = render(
      <RendererV2
        invitation={getSampleInvitation("islamic-soft", "id")}
        packageCode="signature"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));
    expect(
      signature.container.querySelectorAll(
        '[data-invitation-card="signature"]',
      ).length,
    ).toBeGreaterThan(0);
    signature.unmount();

    const couture = render(
      <RendererV2
        invitation={getSampleInvitation("luxury-gold", "id")}
        packageCode="couture"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));
    expect(
      couture.container.querySelector(
        '[data-invitation-card="couture"][data-photo-card="true"]',
      ),
    ).not.toBeNull();
  });

  it("renders the Essential gift section after opening and reveals account details on tap", () => {
    render(
      <RendererV2
        invitation={getSampleInvitation("islamic-soft", "id")}
        packageCode="essential"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));

    expect(screen.getByText("Tanda kasih.")).toBeTruthy();
    expect(screen.queryByText("Prakiraan Cuaca Lokasi Acara")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Gift" }));

    expect(screen.getByText("Rekening pengantin")).toBeTruthy();
    expect(screen.getByText("BCA 615xxxxx")).toBeTruthy();
  });

  it("renders saved bank account details in the gift section", () => {
    const invitation = getSampleInvitation("luxury-gold", "id");

    render(
      <RendererV2
        invitation={{
          ...invitation,
          content: {
            ...invitation.content,
            bank_accounts: [
              {
                bank: "MANDIRI",
                name: "Doni Rifda",
                number: "1234567890",
              },
            ],
          },
        }}
        packageCode="signature"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));
    fireEvent.click(screen.getByRole("button", { name: "Gift" }));

    expect(screen.getByText("MANDIRI 1234567890")).toBeTruthy();
    expect(screen.getByText("Doni Rifda")).toBeTruthy();
  });

  it("adds the subtle contrast layer only when configured", () => {
    const readable = render(
      <RendererV2
        invitation={getSampleInvitation("floral-romantic", "id")}
        packageCode="couture"
      />,
    );
    expect(
      readable.container.querySelector(
        '[data-decoration-layer="text-contrast"]',
      ),
    ).not.toBeNull();
    readable.unmount();

    const unchanged = render(
      <RendererV2
        invitation={getSampleInvitation("luxury-gold", "id")}
        packageCode="couture"
      />,
    );
    expect(
      unchanged.container.querySelector(
        '[data-decoration-layer="text-contrast"]',
      ),
    ).toBeNull();
  });

  it("disables premium loops when reduced motion is requested", () => {
    const couture = getPremiumVisualConfig("elegant-classic", "couture");
    expect(shouldAnimatePremium(couture, false, "cover")).toBe(true);
    expect(shouldAnimatePremium(couture, true, "cover")).toBe(false);
    expect(shouldAnimatePremium(couture, true, "content")).toBe(false);
  });
});

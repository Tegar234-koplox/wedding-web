import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("does not render a music control when no licensed audio exists", () => {
    render(
      <RendererV2
        invitation={getSampleInvitation("dark-cinematic", "en")}
        packageCode="couture"
      />,
    );

    expect(screen.queryByLabelText(/^Play /)).toBeNull();
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
    expect(sectionDecorations.length).toBe(5);
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
    ).toBe(5);
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
    ).toBe(5);
    expect(
      container.querySelectorAll('[data-decoration-layer="section-overlay"]')
        .length,
    ).toBe(5);
    expect(
      container.querySelectorAll('[data-decoration-layer="section-corners"]')
        .length,
    ).toBe(5);
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

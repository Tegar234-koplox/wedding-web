import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { rendererKeys } from "@wedding/invitation-themes";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { getPremiumVisualConfig, themeFrameColors } from "./presentation";
import { RendererV2 } from "./renderer-v2";
import { getSampleInvitation } from "./samples";
import { shouldAnimatePremium } from "./theme-ornament";

beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      private readonly callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        this.callback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }

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
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

describe("renderer v2 invitation experience", () => {
  it.each([
    ["elegant-classic", "Cormorant Garamond", "Montserrat"],
    ["islamic-soft", "Marcellus", "Lora"],
    ["luxury-gold", "Bodoni Moda", "Manrope"],
    ["minimalist-white", "Italiana", "Inter"],
    ["dark-cinematic", "Cormorant SC", "DM Sans"],
    ["floral-romantic", "Great Vibes", "Nunito Sans"],
    ["javanese-traditional", "Noto Serif", "Noto Sans"],
  ] as const)(
    "applies the %s heading and body font pair across package renderers",
    (rendererKey, headingFont, bodyFont) => {
      const view = render(
        <RendererV2
          invitation={getSampleInvitation(rendererKey, "id", "essential")}
          packageCode="essential"
        />,
      );
      const invitation = view.container.querySelector(
        `[data-theme="${rendererKey}"]`,
      ) as HTMLElement;

      expect(invitation.dataset.headingFont).toBe(headingFont);
      expect(invitation.dataset.bodyFont).toBe(bodyFont);
      expect(invitation.style.getPropertyValue("--font-serif")).toContain(
        "heading",
      );
      expect(invitation.style.getPropertyValue("--font-sans")).toContain(
        "body",
      );
      view.unmount();
    },
  );

  it("uses the saved cover URL and focal point, with a theme fallback", () => {
    const custom = render(
      <RendererV2
        cover={{
          focal_x: 18,
          focal_y: 73,
          secure_url: "https://res.cloudinary.com/demo/image/upload/cover.jpg",
        }}
        invitation={getSampleInvitation("elegant-classic", "id")}
        packageCode="signature"
      />,
    );
    const customCover = screen.getByAltText(/Wedding cover/);
    expect(customCover.getAttribute("src")).toContain("cover.jpg");
    expect(customCover.getAttribute("style")).toContain("18% 73%");
    expect(customCover.getAttribute("data-cover-source")).toBe("custom");
    expect(customCover.className).toContain("object-cover");
    custom.unmount();

    render(
      <RendererV2
        invitation={getSampleInvitation("elegant-classic", "id")}
        packageCode="essential"
      />,
    );
    const fallbackCover = screen.getByAltText(/Wedding cover/);
    expect(fallbackCover.getAttribute("src")).toContain("elegant-classic.webp");
    expect(fallbackCover.getAttribute("style")).toContain("50% 50%");
    expect(fallbackCover.getAttribute("data-cover-source")).toBe("theme");
  });

  it("renders custom Signature and Couture section copy", () => {
    const signatureInvitation = getSampleInvitation("islamic-soft", "id");
    const signature = render(
      <RendererV2
        invitation={{
          ...signatureInvitation,
          content: {
            ...signatureInvitation.content,
            story: {
              ...signatureInvitation.content.story,
              sectionBodies: {
                middle: "Copy tengah Signature",
                final: "Copy akhir Signature",
              },
            },
          },
        }}
        packageCode="signature"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));
    expect(screen.getByText("Copy tengah Signature")).toBeTruthy();
    expect(screen.getByText("Copy akhir Signature")).toBeTruthy();
    signature.unmount();

    const coutureInvitation = getSampleInvitation("floral-romantic", "id");
    render(
      <RendererV2
        invitation={{
          ...coutureInvitation,
          content: {
            ...coutureInvitation.content,
            story: {
              ...coutureInvitation.content.story,
              sectionBodies: {
                conflict: "Copy konflik Couture",
                intimacy: "Copy intimasi Couture",
                trust: "Copy kepercayaan Couture",
              },
            },
          },
        }}
        packageCode="couture"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));
    expect(screen.getByText("Copy konflik Couture")).toBeTruthy();
    expect(screen.getByText("Copy intimasi Couture")).toBeTruthy();
    expect(screen.getByText("Copy kepercayaan Couture")).toBeTruthy();
  });

  it("uses exact frame colors and keeps every cover frame static", () => {
    for (const [theme, color] of Object.entries(themeFrameColors)) {
      const view = render(
        <RendererV2
          invitation={getSampleInvitation(
            theme as keyof typeof themeFrameColors,
            "id",
          )}
          packageCode="essential"
        />,
      );
      const coverFrame = view.container.querySelector(
        '[data-cover-frame="essential"]',
      ) as HTMLElement;
      expect(coverFrame.style.getPropertyValue("--card-border")).toBe(color);
      expect(coverFrame.dataset.frameStyle).toBe("subtle");
      expect(coverFrame.dataset.frameMotion).toBe("static");
      view.unmount();
    }

    const premium = render(
      <RendererV2
        invitation={getSampleInvitation("elegant-classic", "id")}
        packageCode="signature"
      />,
    );
    expect(
      premium.container
        .querySelector('[data-cover-frame="signature"]')
        ?.getAttribute("data-frame-motion"),
    ).toBe("static");
    premium.unmount();

    for (const theme of Object.keys(themeFrameColors)) {
      const bright = render(
        <RendererV2
          invitation={getSampleInvitation(
            theme as keyof typeof themeFrameColors,
            "id",
          )}
          packageCode="signature"
        />,
      );
      const cover = bright.container.querySelector(
        '[data-cover-frame="signature"]',
      ) as HTMLElement;
      expect(cover.style.getPropertyValue("--card-border")).toBe(
        themeFrameColors[theme as keyof typeof themeFrameColors],
      );
      expect(cover.style.getPropertyValue("--card-shine")).toBe("#FFFFFF");
      bright.unmount();
    }

    const unchanged = render(
      <RendererV2
        invitation={getSampleInvitation("luxury-gold", "id")}
        packageCode="couture"
      />,
    );
    expect(
      unchanged.container
        .querySelector('[data-cover-frame="couture"]')
        ?.getAttribute("data-frame-style"),
    ).toBe("standard");
    expect(
      unchanged.container
        .querySelector('[data-cover-frame="couture"]')
        ?.getAttribute("data-frame-motion"),
    ).toBe("static");
  });
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

  it("renders the exact sixteen-section Couture contract and 36-slot media layout", () => {
    const { container } = render(
      <RendererV2
        invitation={getSampleInvitation("luxury-gold", "id", "couture")}
        packageCode="couture"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));

    const sections = Array.from(
      container.querySelectorAll<HTMLElement>("[data-couture-section]"),
    );
    expect(sections.map((section) => section.dataset.coutureSection)).toEqual(
      Array.from({ length: 16 }, (_, index) => String(index + 1)),
    );
    expect(container.querySelectorAll("[data-couture-quadrant]")).toHaveLength(
      4,
    );
    expect(
      container.querySelectorAll("[data-couture-gallery-item]"),
    ).toHaveLength(9);
    expect(
      container.querySelectorAll("[data-couture-carousel-slide]"),
    ).toHaveLength(9);
    expect(
      container.querySelectorAll("[data-couture-slideshow-slide]"),
    ).toHaveLength(3);
    expect(
      container.querySelectorAll('[data-couture-background-overlay="50"]'),
    ).toHaveLength(4);

    const frontSections = sections
      .filter((section) =>
        section.querySelector('[data-decoration-front="true"]'),
      )
      .map((section) => section.dataset.coutureSection);
    expect(frontSections).toEqual(["2", "4", "5", "6", "8", "9", "10", "12"]);

    const overlayFrontSections = sections
      .filter((section) =>
        section.querySelector('[data-decoration-overlay-front="true"]'),
      )
      .map((section) => section.dataset.coutureSection);
    expect(overlayFrontSections).toEqual(["2", "4", "6", "8", "10", "12"]);
    expect(
      container.querySelectorAll("[data-couture-background-canvas]"),
    ).toHaveLength(3);
    expect(
      container
        .querySelector('[data-couture-section="9"]')
        ?.getAttribute("data-couture-background-depth"),
    ).toBe("deep");
    expect(
      container
        .querySelector('[data-couture-section="10"]')
        ?.getAttribute("data-couture-depth-entry"),
    ).toBe("section-10-over-section-9");
  });

  it("runs the three-second Couture open sequence and the quick close sequence", () => {
    vi.useFakeTimers();
    const play = vi.mocked(HTMLMediaElement.prototype.play);
    play.mockClear();
    const view = render(
      <RendererV2
        invitation={getSampleInvitation("dark-cinematic", "id", "couture")}
        packageCode="couture"
      />,
    );

    try {
      fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));
      const toggle = screen.getByRole("button", {
        name: "Buka atau tutup foto kedua mempelai",
      });
      expect(toggle.getAttribute("data-motion")).toBe("shake");

      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-busy")).toBe("true");
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(toggle.getAttribute("data-couture-toggle-phase")).toBe(
        "opening-glow",
      );
      expect(play).not.toHaveBeenCalled();

      fireEvent.click(toggle);
      expect(toggle.getAttribute("data-couture-toggle-phase")).toBe(
        "opening-glow",
      );

      act(() => vi.advanceTimersByTime(1000));
      expect(toggle.getAttribute("data-couture-toggle-phase")).toBe(
        "opening-crossfade",
      );
      expect(play).toHaveBeenCalledTimes(1);

      act(() => vi.advanceTimersByTime(1000));
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(toggle.getAttribute("data-couture-toggle-phase")).toBe(
        "opening-burst",
      );
      expect(
        toggle.querySelector('[data-couture-light-burst="outside"]'),
      ).not.toBeNull();

      act(() => vi.advanceTimersByTime(1000));
      expect(toggle.getAttribute("aria-busy")).toBe("false");
      expect(toggle.getAttribute("data-couture-toggle-phase")).toBe("open");

      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(toggle.getAttribute("data-couture-toggle-phase")).toBe("closing");
      expect(play).toHaveBeenCalledTimes(2);
      act(() => vi.advanceTimersByTime(750));
      expect(toggle.getAttribute("data-couture-toggle-phase")).toBe("closed");
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
  });

  it.each(rendererKeys)(
    "uses the %s Couture toggle assets and motion family",
    (rendererKey) => {
      const view = render(
        <RendererV2
          invitation={getSampleInvitation(rendererKey, "en", "couture")}
          packageCode="couture"
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Open Invitation" }));
      const toggle = screen.getByRole("button", {
        name: "Reveal or hide the couple photos",
      });
      const sources = Array.from(toggle.querySelectorAll("img")).map((image) =>
        image.getAttribute("src"),
      );
      const rotating = [
        "floral-romantic",
        "islamic-soft",
        "javanese-traditional",
        "minimalist-white",
      ].includes(rendererKey);

      expect(toggle.getAttribute("data-motion")).toBe(
        rotating ? "rotate" : "shake",
      );
      expect(toggle.getAttribute("data-couture-toggle-surface")).toBe("solid");
      expect(toggle.getAttribute("data-couture-toggle-border")).toBe("glitter");
      expect(toggle.getAttribute("style")).toContain("--couture-toggle-glow");
      expect(
        sources.some((source) =>
          source?.includes(`/toggles/${rendererKey}/before.webp`),
        ),
      ).toBe(true);
      expect(
        sources.some((source) =>
          source?.includes(`/toggles/${rendererKey}/after.webp`),
        ),
      ).toBe(true);
      view.unmount();
    },
  );

  it.each([
    "elegant-classic",
    "islamic-soft",
    "minimalist-white",
    "floral-romantic",
  ] as const)(
    "uses high-contrast photo copy for the %s Couture story backgrounds",
    (rendererKey) => {
      const view = render(
        <RendererV2
          invitation={getSampleInvitation(rendererKey, "id", "couture")}
          packageCode="couture"
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));

      for (const section of ["5", "9"]) {
        expect(
          view.container.querySelector(
            `[data-couture-section="${section}"] [data-couture-text-contrast="bright-photo"]`,
          ),
        ).not.toBeNull();
      }

      for (const toggleId of ["section-2", "section-6"]) {
        const toggle = view.container.querySelector(
          `[data-couture-toggle="${toggleId}"]`,
        ) as HTMLElement;
        expect(toggle.dataset.coutureTogglePalette).toBe(
          "theme-border-white-shine",
        );
        expect(toggle.style.getPropertyValue("--couture-toggle-border")).toBe(
          themeFrameColors[rendererKey],
        );
        expect(toggle.style.getPropertyValue("--couture-toggle-shine")).toBe(
          "#FFFFFF",
        );
      }

      view.unmount();
    },
  );

  it("advances the Couture section 12 slideshow every four seconds while visible", () => {
    vi.useFakeTimers();
    const view = render(
      <RendererV2
        invitation={getSampleInvitation("floral-romantic", "id", "couture")}
        packageCode="couture"
      />,
    );

    try {
      fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));
      const slides = view.container.querySelectorAll(
        "[data-couture-slideshow-slide]",
      );
      expect(slides[0]?.getAttribute("data-couture-slideshow-state")).toBe(
        "active",
      );

      act(() => vi.advanceTimersByTime(4000));
      expect(slides[1]?.getAttribute("data-couture-slideshow-state")).toBe(
        "active",
      );
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
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
      essential.container.querySelectorAll('[data-invitation-card="essential"]')
        .length,
    ).toBeGreaterThan(0);
    expect(
      essential.container.querySelector('[data-ambient-dots="essential"]'),
    ).not.toBeNull();
    essential.unmount();

    const signature = render(
      <RendererV2
        invitation={getSampleInvitation("islamic-soft", "id")}
        packageCode="signature"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));
    expect(
      signature.container.querySelectorAll('[data-invitation-card="signature"]')
        .length,
    ).toBeGreaterThan(0);
    expect(
      signature.container.querySelector(
        '[data-card-context="weather"][data-invitation-card="signature"]',
      ),
    ).not.toBeNull();
    expect(
      signature.container.querySelector('[data-ambient-dots="signature"]'),
    ).not.toBeNull();
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
    expect(
      couture.container.querySelector(
        '[data-card-context="weather"][data-invitation-card="couture"]',
      ),
    ).not.toBeNull();
    expect(
      couture.container.querySelector(
        '[data-card-context="gift"][data-invitation-card="couture"]',
      ),
    ).not.toBeNull();
    expect(
      couture.container.querySelector('[data-ambient-dots="couture"]'),
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

  it("renders the new Essential section order and toggles the couple reveal", () => {
    const invitation = getSampleInvitation(
      "elegant-classic",
      "id",
      "essential",
    );
    const { container } = render(
      <RendererV2 invitation={invitation} packageCode="essential" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));

    expect(
      Array.from(
        container.querySelectorAll<HTMLElement>("[data-essential-section]"),
      ).map((section) => section.dataset.essentialSection),
    ).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(
      container.querySelectorAll("[data-essential-gallery-item]"),
    ).toHaveLength(9);
    expect(
      Array.from(container.querySelectorAll("[data-couple-panel]")).map(
        (panel) => panel.getAttribute("data-couple-panel"),
      ),
    ).toEqual(["groom", "bride"]);

    const toggle = screen.getByRole("button", {
      name: "Buka foto kedua mempelai",
    });
    expect(screen.queryByText(/belum terlihat/i)).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("data-heart-state")).toBe("broken");
    expect(container.querySelectorAll("[data-couple-photo] img")).toHaveLength(
      2,
    );

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("data-heart-state")).toBe("whole");
    expect(
      screen.getByText("Mempelai pria, putra terkasih dari keluarga."),
    ).toBeTruthy();
    expect(
      screen.getByText("Mempelai wanita, putri terkasih dari keluarga."),
    ).toBeTruthy();
    expect(
      container
        .querySelector('[data-couple-panel="groom"] img')
        ?.getAttribute("src"),
    ).toContain("section-2%2Fgroom.webp");
    expect(
      container
        .querySelector('[data-couple-panel="bride"] img')
        ?.getAttribute("src"),
    ).toContain("section-2%2Fbride.webp");
    expect(
      container
        .querySelector('[data-couple-panel="groom"] h2')
        ?.textContent?.trim(),
    ).toBe("Raka");
    expect(
      container
        .querySelector('[data-couple-panel="bride"] h2')
        ?.textContent?.trim(),
    ).toBe("Alya");
    const groomCaption = container.querySelector(
      '[data-couple-caption="groom"]',
    ) as HTMLElement;
    expect(groomCaption.classList.contains("border")).toBe(false);
    expect(groomCaption.classList.contains("bottom-14")).toBe(true);
    expect(
      groomCaption
        .querySelector("[data-couple-caption-surface]")
        ?.classList.contains("opacity-40"),
    ).toBe(true);

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("data-heart-state")).toBe("broken");
  });

  it("renders the thirteen Signature sections and both toggle interactions", () => {
    const invitation = getSampleInvitation(
      "elegant-classic",
      "id",
      "signature",
    );
    const { container } = render(
      <RendererV2 invitation={invitation} packageCode="signature" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));

    const signatureSections = Array.from(
      container.querySelectorAll<HTMLElement>("[data-signature-section]"),
    );
    expect(
      signatureSections.map((section) => section.dataset.signatureSection),
    ).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
    ]);
    expect(
      signatureSections
        .filter((section) =>
          Boolean(section.querySelector('[data-decoration-front="true"]')),
        )
        .map((section) => section.dataset.signatureSection),
    ).toEqual(["2", "4", "6", "8", "10"]);
    const sectionFourPhotos = Array.from(
      container.querySelectorAll<HTMLElement>(
        "[data-signature-section-four-photo]",
      ),
    );
    expect(sectionFourPhotos).toHaveLength(3);
    expect(
      sectionFourPhotos[0]
        ?.querySelector("img")
        ?.classList.contains("object-cover"),
    ).toBe(true);
    expect(
      sectionFourPhotos[1]?.querySelector("[class*='md:min-h-[70svh]']"),
    ).not.toBeNull();
    expect(
      container.querySelectorAll("[data-signature-gallery-item]"),
    ).toHaveLength(9);
    expect(
      container.querySelectorAll("[data-signature-carousel-slide]"),
    ).toHaveLength(9);
    expect(
      container.querySelectorAll("[data-signature-quadrant]"),
    ).toHaveLength(4);

    const firstTimelineCard = screen
      .getByRole("heading", { name: "Bertemu" })
      .closest("[data-invitation-card]");
    expect(firstTimelineCard?.textContent).not.toContain("01");

    const coupleToggle = screen.getByRole("button", {
      name: "Buka foto Signature kedua mempelai",
    });
    expect(coupleToggle.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelectorAll("[data-signature-couple-photo] img"),
    ).toHaveLength(2);
    fireEvent.click(coupleToggle);
    expect(coupleToggle.getAttribute("aria-expanded")).toBe("true");
    expect(
      container
        .querySelector('[data-signature-couple-panel="groom"] h2')
        ?.textContent?.trim(),
    ).toBe(invitation.content.couple.partnerTwo);
    fireEvent.click(coupleToggle);
    expect(coupleToggle.getAttribute("aria-expanded")).toBe("false");

    const quadrantToggle = screen.getByRole("button", {
      name: "Buka galeri empat foto",
    });
    expect(quadrantToggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(quadrantToggle);
    expect(quadrantToggle.getAttribute("aria-expanded")).toBe("true");
    expect(
      container.querySelector("[data-signature-section-six-cover]"),
    ).not.toBeNull();
    expect(
      container
        .querySelector("[data-signature-section-six-overlay]")
        ?.classList.contains("opacity-50"),
    ).toBe(true);
    fireEvent.click(quadrantToggle);
    expect(quadrantToggle.getAttribute("aria-expanded")).toBe("false");

    const next = screen.getByRole("button", { name: "Foto berikutnya" });
    const previous = screen.getByRole("button", { name: "Foto sebelumnya" });
    expect(previous.hasAttribute("disabled")).toBe(true);
    fireEvent.click(next);
    expect(previous.hasAttribute("disabled")).toBe(false);
  });

  it.each(rendererKeys)(
    "uses the %s Signature toggle icon pair",
    (rendererKey) => {
      const view = render(
        <RendererV2
          invitation={getSampleInvitation(rendererKey, "en", "signature")}
          packageCode="signature"
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Open Invitation" }));
      const toggle = screen.getByRole("button", {
        name: "Reveal Signature couple photos",
      });
      const sources = Array.from(toggle.querySelectorAll("img")).map((image) =>
        image.getAttribute("src"),
      );
      expect(
        sources.some((source) => source?.includes(`${rendererKey}-before.svg`)),
      ).toBe(true);
      expect(
        sources.some((source) => source?.includes(`${rendererKey}-after.svg`)),
      ).toBe(true);
      view.unmount();
    },
  );

  it("uses a darker high-contrast caption for Floral Romantic Section 2", () => {
    const invitation = getSampleInvitation(
      "floral-romantic",
      "id",
      "signature",
    );
    const { container } = render(
      <RendererV2 invitation={invitation} packageCode="signature" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buka Undangan" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Buka foto Signature kedua mempelai",
      }),
    );

    const caption = container.querySelector(
      '[data-signature-couple-caption="groom"] [data-couple-caption-text="floral-romantic"]',
    );
    expect(caption?.classList.contains("!text-[#271216]")).toBe(true);
    expect(caption?.textContent).toContain(
      invitation.content.couple.partnerTwo,
    );
    expect(caption?.textContent).toContain("Mempelai pria");
  });

  it.each(rendererKeys)(
    "uses the %s heart assets for Essential without adding them to premium packages",
    (rendererKey) => {
      const invitation = getSampleInvitation(rendererKey, "en", "essential");
      const essential = render(
        <RendererV2 invitation={invitation} packageCode="essential" />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Open Invitation" }));
      const toggle = screen.getByRole("button", {
        name: "Reveal couple photos",
      });
      const heartSources = Array.from(toggle.querySelectorAll("img")).map(
        (image) => image.getAttribute("src"),
      );
      expect(
        heartSources.some((src) => src?.includes(`${rendererKey}-broken.svg`)),
      ).toBe(true);
      expect(
        heartSources.some((src) => src?.includes(`${rendererKey}-whole.svg`)),
      ).toBe(true);
      fireEvent.click(toggle);
      const couplePanels = essential.container.querySelectorAll(
        "[data-couple-panel]",
      );
      expect(couplePanels[0]?.getAttribute("data-couple-panel")).toBe("groom");
      expect(couplePanels[1]?.getAttribute("data-couple-panel")).toBe("bride");
      expect(couplePanels[0]?.querySelector("h2")?.textContent?.trim()).toBe(
        invitation.content.couple.partnerTwo,
      );
      expect(couplePanels[1]?.querySelector("h2")?.textContent?.trim()).toBe(
        invitation.content.couple.partnerOne,
      );
      essential.unmount();

      for (const packageCode of ["signature", "couture"] as const) {
        const premium = render(
          <RendererV2
            invitation={getSampleInvitation(rendererKey, "en")}
            packageCode={packageCode}
          />,
        );
        fireEvent.click(
          screen.getByRole("button", { name: "Open Invitation" }),
        );
        expect(
          premium.container.querySelector('[data-essential-section="2"]'),
        ).toBeNull();
        premium.unmount();
      }
    },
  );

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

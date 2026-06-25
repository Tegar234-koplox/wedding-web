import { packageCodes, rendererKeys } from "@wedding/invitation-themes";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  getPremiumVisualConfig,
  packageCapabilities,
  premiumVisualConfig,
  resolvePackageCode,
  themeVisualConfig,
} from "./presentation";

describe("premium presentation configuration", () => {
  it("defines a distinct visual system for every renderer", () => {
    expect(Object.keys(themeVisualConfig)).toEqual([...rendererKeys]);
    expect(
      new Set(rendererKeys.map((key) => themeVisualConfig[key].ornament)).size,
    ).toBe(7);
  });

  it("supports all theme and package combinations", () => {
    const combinations = rendererKeys.flatMap((theme) =>
      packageCodes.map((packageCode) => ({
        theme,
        packageCode,
        visual: themeVisualConfig[theme],
        premium: premiumVisualConfig[theme][packageCode],
        capability: packageCapabilities[packageCode],
      })),
    );

    expect(combinations).toHaveLength(21);
    expect(combinations.every((item) => item.visual.coverImage)).toBe(true);
    expect(combinations.every((item) => item.premium)).toBe(true);
  });

  it("keeps Essential free from premium visual overrides", () => {
    rendererKeys.forEach((theme) => {
      const essential = getPremiumVisualConfig(theme, "essential");
      expect(essential.overlay).toBeNull();
      expect(essential.corners).toBeNull();
      expect(essential.textContrast).toBe(false);
      expect(essential.opacity).toBe(0);
    });
  });

  it("maps every Signature and Couture theme to the PDF decorations", () => {
    rendererKeys.forEach((theme) => {
      const signature = getPremiumVisualConfig(theme, "signature");
      const couture = getPremiumVisualConfig(theme, "couture");

      expect(signature.overlay).not.toBeNull();
      expect(signature.corners).not.toBeNull();
      expect(signature.coverAnimated).toBe(false);
      expect(couture.overlay?.src).toBe(signature.overlay?.src);
      expect(couture.corners).toEqual(signature.corners);
      expect(couture.contentAnimated).toBe(true);
      expect(signature.opacity).toBe(0.7);
      expect(couture.opacity).toBe(0.7);
    });
  });

  it("maps every configured decoration to an existing public asset", () => {
    rendererKeys.forEach((theme) => {
      ["signature", "couture"].forEach((packageCode) => {
        const visual = getPremiumVisualConfig(
          theme,
          packageCode as "signature" | "couture",
        );
        const sources = [
          visual.overlay?.src,
          ...(visual.corners?.mode === "frame"
            ? [visual.corners.src]
            : visual.corners
              ? Object.values(visual.corners.sources)
              : []),
        ].filter((source): source is string => Boolean(source));

        sources.forEach((source) => {
          expect(
            existsSync(join(process.cwd(), "public", source)),
            source,
          ).toBe(true);
        });
      });
    });
  });

  it("adds cover contrast only to the three themes named in the revision", () => {
    const readableThemes = [
      "elegant-classic",
      "islamic-soft",
      "floral-romantic",
    ];

    rendererKeys.forEach((theme) => {
      expect(getPremiumVisualConfig(theme, "signature").textContrast).toBe(
        readableThemes.includes(theme),
      );
      expect(getPremiumVisualConfig(theme, "couture").textContrast).toBe(
        readableThemes.includes(theme),
      );
    });
  });

  it("uses individual corner assets for the three updated floral/photo themes", () => {
    const updatedThemes = [
      "minimalist-white",
      "dark-cinematic",
      "floral-romantic",
    ] as const;

    updatedThemes.forEach((theme) => {
      ["signature", "couture"].forEach((packageCode) => {
        const visual = getPremiumVisualConfig(
          theme,
          packageCode as "signature" | "couture",
        );

        expect(visual.corners?.mode).toBe("individual");
        if (visual.corners?.mode !== "individual") {
          throw new Error(`${theme} corners should use individual assets`);
        }

        expect(visual.corners.layout).toBe("corner");
        expect(visual.corners.sources.topLeft).toContain(
          `${theme}/corner-top-left.webp`,
        );
        expect(visual.corners.sources.topRight).toContain(
          `${theme}/corner-top-right.webp`,
        );
        expect(visual.corners.sources.bottomLeft).toContain(
          `${theme}/corner-bottom-left.webp`,
        );
        expect(visual.corners.sources.bottomRight).toContain(
          `${theme}/corner-bottom-right.webp`,
        );
      });
    });
  });

  it("uses the supplied sparse kawung overlay and megamendung corner assets", () => {
    ["signature", "couture"].forEach((packageCode) => {
      const visual = getPremiumVisualConfig(
        "javanese-traditional",
        packageCode as "signature" | "couture",
      );
      expect(visual.overlay?.src).toContain("javanese-traditional/overlay.svg");
      expect(visual.corners?.mode).toBe("individual");
      if (visual.corners?.mode !== "individual") {
        throw new Error("Javanese corners should use individual assets");
      }

      expect(visual.corners.layout).toBe("corner");
      expect(visual.corners.sources.topLeft).toBeUndefined();
      expect(visual.corners.sources.topRight).toContain(
        "javanese-traditional/corner-top-right.webp",
      );
      expect(visual.corners.sources.bottomLeft).toContain(
        "javanese-traditional/corner-bottom-left.webp",
      );
      expect(visual.corners.sources.bottomRight).toBeUndefined();
    });
  });

  it("limits motif overlays to two mobile and three desktop instances", () => {
    ["minimalist-white", "dark-cinematic", "floral-romantic"].forEach(
      (theme) => {
        const overlay = getPremiumVisualConfig(
          theme as "minimalist-white" | "dark-cinematic" | "floral-romantic",
          "couture",
        ).overlay;
        expect(overlay?.mode).toBe("motif");
        expect(overlay?.mobileInstances).toBe(2);
        expect(overlay?.desktopInstances).toBe(3);
      },
    );
  });
  it("falls back invalid preview packages to Signature", () => {
    expect(resolvePackageCode("essential")).toBe("essential");
    expect(resolvePackageCode("couture")).toBe("couture");
    expect(resolvePackageCode("unknown")).toBe("signature");
    expect(resolvePackageCode(undefined)).toBe("signature");
  });
});

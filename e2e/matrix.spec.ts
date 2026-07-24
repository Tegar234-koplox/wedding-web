import { expect, test } from "@playwright/test";

const themes = [
  "elegant-classic",
  "islamic-soft",
  "luxury-gold",
  "minimalist-white",
  "dark-cinematic",
  "floral-romantic",
  "javanese-traditional",
] as const;
const packageCodes = ["essential", "signature", "couture"] as const;

test.describe.configure({ mode: "parallel" });

for (const theme of themes) {
  for (const packageCode of packageCodes) {
    test(`${theme} ${packageCode} renders without layout errors`, async ({
      page,
    }, testInfo) => {
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });

      await page.goto(`/id/preview/${theme}?package=${packageCode}`);
      await page.getByRole("button", { name: /buka undangan/i }).click();
      await expect(page.getByText("Akad dan Resepsi").first()).toBeVisible();
      await page.addStyleTag({
        content:
          "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
      });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      expect(consoleErrors).toEqual([]);

      if (packageCode === "essential") {
        const coupleSection = page.locator('[data-essential-section="2"]');
        const coupleGrid = page.locator("#essential-couple-reveal-panels");
        const gallery = page.locator('[data-essential-section="6"] > div');
        await expect(coupleSection).toBeAttached();
        await expect(
          page.getByRole("button", { name: "Buka foto kedua mempelai" }),
        ).toHaveAttribute("aria-expanded", "false");
        await page
          .getByRole("button", { name: "Buka foto kedua mempelai" })
          .click();
        await expect(
          page.getByRole("button", { name: "Tutup foto kedua mempelai" }),
        ).toHaveAttribute("aria-expanded", "true");
        await expect(
          coupleSection.locator("[data-couple-panel]").nth(0),
        ).toHaveAttribute("data-couple-panel", "groom");
        await expect(
          coupleSection.locator("[data-couple-panel]").nth(1),
        ).toHaveAttribute("data-couple-panel", "bride");
        await expect(
          coupleSection.locator("[data-couple-caption-surface]").first(),
        ).toHaveCSS("opacity", "0.3");
        await expect(page.locator("[data-essential-gallery-item]")).toHaveCount(
          9,
        );
        expect(
          await gallery.evaluate(
            (element) =>
              getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/)
                .length,
          ),
        ).toBe(3);

        if (theme === "elegant-classic") {
          const originalViewport = page.viewportSize();
          await page.setViewportSize({ width: 768, height: 1024 });
          expect(
            await coupleGrid.evaluate(
              (element) =>
                getComputedStyle(element).gridTemplateRows.trim().split(/\s+/)
                  .length,
            ),
          ).toBe(2);
          const heartBounds = await page
            .getByRole("button", { name: "Tutup foto kedua mempelai" })
            .boundingBox();
          const topCaptionBounds = await coupleSection
            .locator('[data-couple-caption="groom"]')
            .boundingBox();
          expect(heartBounds).not.toBeNull();
          expect(topCaptionBounds).not.toBeNull();
          expect(
            (topCaptionBounds?.y ?? 0) + (topCaptionBounds?.height ?? 0),
          ).toBeLessThanOrEqual(heartBounds?.y ?? 0);

          await page.setViewportSize({ width: 1440, height: 900 });
          expect(
            await coupleGrid.evaluate(
              (element) =>
                getComputedStyle(element)
                  .gridTemplateColumns.trim()
                  .split(/\s+/).length,
            ),
          ).toBe(2);
          if (originalViewport) {
            await page.setViewportSize(originalViewport);
          }
        }
      }

      await page.screenshot({
        animations: "disabled",
        path: testInfo.outputPath(`${theme}-${packageCode}.png`),
      });
    });
  }
}

import { expect, test } from "@playwright/test";

const cases = [
  { theme: "elegant-classic", packageCode: "essential" },
  { theme: "dark-cinematic", packageCode: "signature" },
  { theme: "luxury-gold", packageCode: "couture" },
] as const;

for (const item of cases) {
  test(`${item.theme} ${item.packageCode} invitation`, async ({ page }) => {
    await page.goto(`/id/preview/${item.theme}?package=${item.packageCode}`);
    await page.addStyleTag({
      content: `
        *,*::before,*::after {
          animation: none !important;
          caret-color: transparent !important;
          transition: none !important;
        }
        [data-invitation-motion] [style*="opacity"] {
          opacity: 1 !important;
          transform: none !important;
        }
        [data-decoration-layer] * {
          transform: none !important;
        }
      `,
    });
    await page.getByRole("button", { name: /buka undangan/i }).click();
    await expect(page.getByText("Akad dan Resepsi").first()).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(async () => {
      const visibleImages = Array.from(document.images).filter((image) => {
        const rect = image.getBoundingClientRect();
        return (
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < window.innerHeight &&
          rect.left < window.innerWidth
        );
      });
      await Promise.all(
        visibleImages.map((image) =>
          image.complete
            ? Promise.resolve()
            : image.decode().catch(() => undefined),
        ),
      );
    });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${item.theme}-${item.packageCode}.png`,
      { fullPage: false },
    );
  });
}

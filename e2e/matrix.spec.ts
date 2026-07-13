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
      await page.screenshot({
        animations: "disabled",
        path: testInfo.outputPath(`${theme}-${packageCode}.png`),
      });
    });
  }
}

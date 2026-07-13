import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  outputDir: "test-results/playwright",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "line",
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      // Linux Chromium rasterizes text and translucent overlays differently
      // from local Windows Chrome. Keep the strict area cap below while
      // tolerating those per-pixel anti-aliasing differences in CI.
      threshold: process.env.CI ? 0.32 : 0.2,
      maxDiffPixelRatio: 0.015,
      timeout: 30_000,
    },
  },
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",
  use: {
    baseURL,
    channel: process.env.CI ? undefined : "chrome",
    locale: "id-ID",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "smoke-chromium",
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "visual-desktop",
      testMatch: /visual\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "visual-mobile",
      testMatch: /visual\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "matrix-desktop",
      testMatch: /matrix\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "matrix-mobile",
      testMatch: /matrix\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command:
          "pnpm --filter @wedding/web exec next dev --hostname 127.0.0.1 --port 3100",
        env: {
          NEXT_PUBLIC_API_URL: "http://127.0.0.1:8000/api/v1",
          NEXT_PUBLIC_SITE_URL: baseURL,
        },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: baseURL,
      },
});

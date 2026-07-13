import { expect, test } from "@playwright/test";

const apiBase = "http://127.0.0.1:8000/api/v1";

test("admin route redirects before rendering protected content", async ({
  page,
}) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(
    page.getByRole("heading", { name: "Login staff." }),
  ).toBeVisible();
  await expect(page.getByText("Order management.")).toHaveCount(0);
});

test("forged UX gate cookie cannot bypass the Django session check", async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: "niskala_staff_gate",
      value: "1",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.route(`${apiBase}/auth/me`, (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        detail: "Authentication credentials were not provided.",
      }),
    }),
  );

  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByText("Order management.")).toHaveCount(0);
});

test("staff login requires and completes the second factor", async ({
  page,
}) => {
  await page.route(`${apiBase}/**`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route(`${apiBase}/auth/csrf`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "test-csrf" }),
    }),
  );
  await page.route(`${apiBase}/auth/login`, (route) =>
    route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        challenge: "test-mfa-challenge",
        enrollment_required: false,
        mfa_required: true,
      }),
    }),
  );
  await page.route(`${apiBase}/auth/login/mfa`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          username: "operator",
          email: "operator@example.com",
          role: "staff",
          display_name: "Operator",
          mfa_enrolled: true,
        },
      }),
    }),
  );
  await page.route(`${apiBase}/auth/me`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          username: "operator",
          email: "operator@example.com",
          role: "staff",
          display_name: "Operator",
          mfa_enrolled: true,
        },
      }),
    }),
  );
  await page.goto("/admin/login");
  await page.getByLabel("Username atau email").fill("operator");
  await page.getByLabel("Password").fill("valid-password");
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(
    page.getByLabel("Kode authenticator atau recovery"),
  ).toBeVisible();
  await page.getByLabel("Kode authenticator atau recovery").fill("123456");
  await page.getByRole("button", { name: "Verifikasi" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("public responses use a static-compatible CSP", async ({ request }) => {
  const response = await request.get("/id");
  const csp = response.headers()["content-security-policy"] ?? "";

  expect(response.ok()).toBeTruthy();
  expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  expect(csp).not.toContain("'strict-dynamic'");
  expect(csp).not.toContain("'nonce-");
});

test("admin responses retain nonce CSP without unsafe inline scripts", async ({
  request,
}) => {
  const response = await request.get("/admin/login");
  const csp = response.headers()["content-security-policy"] ?? "";

  expect(response.ok()).toBeTruthy();
  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
});

test("landing page hydrates and runs its entrance motion", async ({ page }) => {
  const cspErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("Content Security Policy")
    ) {
      cspErrors.push(message.text());
    }
  });

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/id");

  const heroLine = page.locator("[data-hero-line]").first();
  await expect(heroLine).toBeVisible();
  await expect.poll(() => heroLine.getAttribute("style")).toContain("opacity");
  expect(cspErrors).toEqual([]);
});

test("invitation preview remains behind its cover until opened", async ({
  page,
}) => {
  await page.goto("/id/preview/elegant-classic?package=signature");

  const openButton = page.getByRole("button", { name: /buka undangan/i });
  await expect(openButton).toBeVisible();
  await openButton.click();
  await expect(page.getByText("Akad dan Resepsi").first()).toBeVisible();
});

import { describe, expect, it } from "vitest";

import { createWhatsAppUrl } from "./whatsapp";

describe("createWhatsAppUrl", () => {
  it("encodes Indonesian theme context", () => {
    const url = createWhatsAppUrl({
      locale: "id",
      theme: "Dark Cinematic",
    });

    expect(url).toContain("https://wa.me/");
    expect(decodeURIComponent(url)).toContain("theme Dark Cinematic");
    expect(url).not.toContain(" ");
  });

  it("encodes English package context", () => {
    const url = createWhatsAppUrl({
      locale: "en",
      packageCode: "Signature",
    });

    expect(decodeURIComponent(url)).toContain("package Signature");
    expect(decodeURIComponent(url)).toContain("May I schedule a consultation?");
  });
});

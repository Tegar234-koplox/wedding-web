import { describe, expect, it } from "vitest";

import {
  invitationEnvelopeSchema,
  packageCapabilities,
  packageCodes,
  rendererKeys,
  supportsRenderer,
} from "./schema";

describe("renderer manifest", () => {
  it("registers all seven renderers at versions one and two", () => {
    expect(rendererKeys).toHaveLength(7);
    expect(rendererKeys.every((key) => supportsRenderer(key, 1, 1))).toBe(true);
    expect(rendererKeys.every((key) => supportsRenderer(key, 2, 1))).toBe(true);
  });

  it("rejects unsupported versions", () => {
    expect(supportsRenderer("elegant-classic", 3, 1)).toBe(false);
  });

  it("defines progressive capabilities for all packages", () => {
    expect(packageCodes).toEqual(["essential", "signature", "couture"]);
    expect(packageCapabilities.essential.weather).toBe(false);
    expect(packageCapabilities.signature.weather).toBe(true);
    expect(packageCapabilities.couture.motion).toBe("refined");
  });
});

describe("invitation envelope", () => {
  it("rejects unsafe map protocols", () => {
    const result = invitationEnvelopeSchema.safeParse({
      rendererKey: "elegant-classic",
      rendererVersion: 1,
      contentSchemaVersion: 1,
      locale: "id",
      content: {
        couple: { partnerOne: "Alya", partnerTwo: "Raka", monogram: "A&R" },
        opening: {
          eyebrow: "The wedding of",
          title: "A celebration",
          message: "Together with our families.",
        },
        event: {
          dateLabel: "12 September 2026",
          ceremonyLabel: "Akad",
          ceremonyTime: "09.00 WIB",
          receptionLabel: "Resepsi",
          receptionTime: "11.00 WIB",
          venue: "Venue",
          address: "Jakarta",
          mapUrl: "javascript:alert(1)",
        },
        story: { heading: "Our story", body: "A long story." },
        quote: { text: "A quote.", attribution: "Us" },
        gallery: [
          { src: "/one.jpg", alt: "One" },
          { src: "/two.jpg", alt: "Two" },
          { src: "/three.jpg", alt: "Three" },
        ],
        closing: { heading: "Thank you", message: "See you." },
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts sectioned Cloudinary gallery media for Couture", () => {
    const result = invitationEnvelopeSchema.safeParse({
      rendererKey: "elegant-classic",
      rendererVersion: 2,
      contentSchemaVersion: 1,
      locale: "id",
      content: {
        couple: { partnerOne: "Alya", partnerTwo: "Raka", monogram: "A&R" },
        opening: {
          eyebrow: "The wedding of",
          title: "A celebration",
          message: "Together with our families.",
        },
        event: {
          dateLabel: "12 September 2026",
          ceremonyLabel: "Akad",
          ceremonyTime: "09.00 WIB",
          receptionLabel: "Resepsi",
          receptionTime: "11.00 WIB",
          venue: "Venue",
          address: "Jakarta",
          mapUrl: "https://maps.google.com",
        },
        story: { heading: "Our story", body: "A long story." },
        quote: { text: "A quote.", attribution: "Us" },
        gallery: Array.from({ length: 18 }, (_, index) => ({
          alt: `Gallery ${index + 1}`,
          src: `https://res.cloudinary.com/demo/image/upload/gallery-${index + 1}.jpg`,
        })),
        closing: { heading: "Thank you", message: "See you." },
      },
    });

    expect(result.success).toBe(true);
  });
});

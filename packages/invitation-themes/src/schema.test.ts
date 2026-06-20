import { describe, expect, it } from "vitest";

import {
  invitationEnvelopeSchema,
  rendererKeys,
  supportsRenderer,
} from "./schema";

describe("renderer manifest", () => {
  it("registers all seven renderers at version one", () => {
    expect(rendererKeys).toHaveLength(7);
    expect(rendererKeys.every((key) => supportsRenderer(key, 1, 1))).toBe(true);
  });

  it("rejects unsupported versions", () => {
    expect(supportsRenderer("elegant-classic", 2, 1)).toBe(false);
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
});

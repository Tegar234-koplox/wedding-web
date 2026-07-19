import { describe, expect, it } from "vitest";

import {
  invitationContentSchema,
  invitationEnvelopeSchema,
  defaultBespokeConfig,
  packageCapabilities,
  packageCodes,
  rendererKeys,
  standardRendererKeys,
  supportsRenderer,
} from "./schema";

describe("section story copy", () => {
  it("accepts optional copy for every premium story section", () => {
    const result = invitationContentSchema.shape.story.safeParse({
      body: "Opening copy",
      heading: "Our story",
      sectionBodies: {
        conflict: "Conflict copy",
        final: "Final copy",
        intimacy: "Intimacy copy",
        middle: "Middle copy",
        trust: "Trust copy",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects section copy longer than 1200 characters", () => {
    const result = invitationContentSchema.shape.story.safeParse({
      body: "Opening copy",
      heading: "Our story",
      sectionBodies: { middle: "a".repeat(1201) },
    });

    expect(result.success).toBe(false);
  });
});

describe("invitation cover snapshot", () => {
  it("accepts a responsive Cloudinary cover focal point", () => {
    const result = invitationContentSchema.shape.cover.safeParse({
      secure_url: "https://res.cloudinary.com/demo/image/upload/cover.jpg",
      focal_x: 24.25,
      focal_y: 73.5,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an out-of-range focal point", () => {
    const result = invitationContentSchema.shape.cover.safeParse({
      secure_url: "https://res.cloudinary.com/demo/image/upload/cover.jpg",
      focal_x: 101,
      focal_y: 50,
    });

    expect(result.success).toBe(false);
  });
});

describe("renderer manifest", () => {
  it("registers all seven renderers at versions one and two", () => {
    expect(standardRendererKeys).toHaveLength(7);
    expect(
      standardRendererKeys.every((key) => supportsRenderer(key, 1, 1)),
    ).toBe(true);
    expect(
      standardRendererKeys.every((key) => supportsRenderer(key, 2, 1)),
    ).toBe(true);
    expect(rendererKeys).toContain("bespoke");
    expect(supportsRenderer("bespoke", 1, 2)).toBe(true);
    expect(supportsRenderer("bespoke", 2, 2)).toBe(false);
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
  it("requires a validated structured config for the Bespoke renderer", () => {
    const baseContent = {
      couple: { partnerOne: "Alya", partnerTwo: "Raka", monogram: "A&R" },
      opening: {
        eyebrow: "Wedding",
        title: "A celebration",
        message: "Together.",
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
      gallery: [
        { src: "/one.jpg", alt: "One" },
        { src: "/two.jpg", alt: "Two" },
        { src: "/three.jpg", alt: "Three" },
      ],
      closing: { heading: "Thank you", message: "See you." },
    };
    expect(
      invitationEnvelopeSchema.safeParse({
        rendererKey: "bespoke",
        rendererVersion: 1,
        contentSchemaVersion: 2,
        locale: "id",
        content: baseContent,
      }).success,
    ).toBe(false);
    expect(
      invitationEnvelopeSchema.safeParse({
        rendererKey: "bespoke",
        rendererVersion: 1,
        contentSchemaVersion: 2,
        locale: "id",
        content: { ...baseContent, bespoke: defaultBespokeConfig },
      }).success,
    ).toBe(true);
  });

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
          ceremonyVenue: "Ceremony Venue",
          ceremonyAddress: "Ceremony Address",
          ceremonyMapUrl: "https://maps.google.com/?q=ceremony",
          receptionVenue: "Reception Venue",
          receptionAddress: "Reception Address",
          receptionMapUrl: "https://maps.google.com/?q=reception",
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
    expect(result.data?.content.event.ceremonyVenue).toBe("Ceremony Venue");
    expect(result.data?.content.event.receptionVenue).toBe("Reception Venue");
  });

  it("keeps optional bank account details for gift sections", () => {
    const result = invitationEnvelopeSchema.safeParse({
      rendererKey: "luxury-gold",
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
        gallery: [
          { src: "/one.jpg", alt: "One" },
          { src: "/two.jpg", alt: "Two" },
          { src: "/three.jpg", alt: "Three" },
        ],
        closing: { heading: "Thank you", message: "See you." },
        bank_accounts: [{ bank: "BCA", name: "Doni", number: "1234567890" }],
      },
    });

    expect(result.success).toBe(true);
    expect(result.data?.content.bank_accounts?.[0]?.number).toBe("1234567890");
  });
});

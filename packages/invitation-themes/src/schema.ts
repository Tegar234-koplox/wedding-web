import { z } from "zod";

export const standardRendererKeys = [
  "elegant-classic",
  "islamic-soft",
  "luxury-gold",
  "minimalist-white",
  "dark-cinematic",
  "floral-romantic",
  "javanese-traditional",
] as const;
export type StandardRendererKey = (typeof standardRendererKeys)[number];

export const rendererKeys = [...standardRendererKeys, "bespoke"] as const;

export const rendererKeySchema = z.enum(rendererKeys);
export type RendererKey = z.infer<typeof rendererKeySchema>;

export const localeSchema = z.enum(["id", "en"]);
export type InvitationLocale = z.infer<typeof localeSchema>;

export const packageCodes = ["essential", "signature", "couture"] as const;
export const packageCodeSchema = z.enum(packageCodes);
export type PackageCode = z.infer<typeof packageCodeSchema>;

export const catalogPackageCodes = [...packageCodes, "bespoke"] as const;
export const catalogPackageCodeSchema = z.enum(catalogPackageCodes);
export type CatalogPackageCode = z.infer<typeof catalogPackageCodeSchema>;

export type PackageCapabilities = {
  cover: true;
  audio: true;
  weather: boolean;
  overlay: "restrained" | "themed" | "layered";
  motion: "light" | "standard" | "refined";
  parallax: "none" | "subtle" | "premium";
};

export const packageCapabilities: Record<PackageCode, PackageCapabilities> = {
  essential: {
    cover: true,
    audio: true,
    weather: false,
    overlay: "restrained",
    motion: "light",
    parallax: "none",
  },
  signature: {
    cover: true,
    audio: true,
    weather: true,
    overlay: "themed",
    motion: "standard",
    parallax: "subtle",
  },
  couture: {
    cover: true,
    audio: true,
    weather: true,
    overlay: "layered",
    motion: "refined",
    parallax: "premium",
  },
};

const safeText = z.string().trim().min(1).max(1200);
const safeUrl = z
  .string()
  .max(500)
  .url()
  .refine(
    (url) => {
      const protocol = new URL(url).protocol;
      return protocol === "https:" || protocol === "http:";
    },
    { message: "Only HTTP(S) URLs are allowed" },
  );
const safeMediaSrc = z
  .string()
  .max(500)
  .refine(
    (src) => {
      if (src.startsWith("/")) {
        return true;
      }
      try {
        const protocol = new URL(src).protocol;
        return protocol === "https:" || protocol === "http:";
      } catch {
        return false;
      }
    },
    { message: "Only local paths or HTTP(S) URLs are allowed" },
  );

const timelineEntrySchema = z.object({
  description: safeText.max(700),
  number: safeText.max(8),
  title: safeText.max(120),
});

export const bespokeSectionTypes = [
  "cover",
  "event",
  "story",
  "timeline",
  "gallery",
  "quote",
  "rsvp",
  "gift",
  "weather",
  "closing",
] as const;

export const bespokeSectionTypeSchema = z.enum(bespokeSectionTypes);
export type BespokeSectionType = z.infer<typeof bespokeSectionTypeSchema>;

export const bespokeVariantIds = {
  cover: [
    "cover.editorial-split@1",
    "cover.cinematic-center@1",
    "cover.minimal-frame@1",
  ],
  event: ["event.editorial-cards@1", "event.timeline-band@1"],
  story: ["story.chapters@1", "story.manifesto@1"],
  timeline: ["timeline.vertical@1", "timeline.horizontal@1"],
  gallery: ["gallery.asymmetric-grid@1", "gallery.film-strip@1"],
  quote: ["quote.statement@1"],
  rsvp: ["rsvp.minimal@1"],
  gift: ["gift.cards@1"],
  weather: ["weather.editorial@1"],
  closing: ["closing.signature@1"],
} as const satisfies Record<BespokeSectionType, readonly string[]>;

const bespokeFontIds = [
  "cormorant-garamond",
  "playfair-display",
  "bodoni-moda",
  "lora",
  "inter",
  "manrope",
] as const;

const hexColor = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex color");

const bespokeSectionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    type: bespokeSectionTypeSchema,
    variant: z.string().trim().min(1).max(80),
    enabled: z.boolean().default(true),
    mediaStart: z.number().int().min(0).max(17).optional(),
    mediaCount: z.number().int().min(1).max(18).optional(),
  })
  .superRefine((section, context) => {
    const supported = bespokeVariantIds[section.type] as readonly string[];
    if (!supported.includes(section.variant)) {
      context.addIssue({
        code: "custom",
        message: `Variant ${section.variant} is not supported for ${section.type}`,
        path: ["variant"],
      });
    }
  });

export const bespokeConfigSchema = z
  .object({
    engineVersion: z.literal(1),
    designVersion: z.string().trim().min(1).max(80),
    tokens: z.object({
      background: hexColor,
      surface: hexColor,
      text: hexColor,
      muted: hexColor,
      accent: hexColor,
      border: hexColor,
      displayFont: z.enum(bespokeFontIds),
      bodyFont: z.enum(bespokeFontIds),
      spacing: z.enum(["compact", "balanced", "editorial"]),
      radius: z.enum(["none", "soft", "rounded"]),
    }),
    motion: z.object({
      preset: z.enum(["none", "soft-reveal", "editorial", "cinematic"]),
      intensity: z.enum(["subtle", "balanced", "expressive"]),
      parallax: z.enum(["none", "subtle", "premium"]),
      reducedMotionFallback: z.literal(true),
    }),
    sections: z.array(bespokeSectionSchema).min(3).max(20),
  })
  .superRefine((config, context) => {
    const enabled = config.sections.filter((section) => section.enabled);
    const ids = new Set<string>();
    for (const [index, section] of config.sections.entries()) {
      if (ids.has(section.id)) {
        context.addIssue({
          code: "custom",
          message: "Section ids must be unique",
          path: ["sections", index, "id"],
        });
      }
      ids.add(section.id);
    }
    for (const required of ["cover", "event", "closing"] as const) {
      if (!enabled.some((section) => section.type === required)) {
        context.addIssue({
          code: "custom",
          message: `An enabled ${required} section is required`,
          path: ["sections"],
        });
      }
    }
  });

export type BespokeConfig = z.infer<typeof bespokeConfigSchema>;

export const defaultBespokeConfig: BespokeConfig = {
  engineVersion: 1,
  designVersion: "bespoke-initial@1",
  tokens: {
    background: "#11110f",
    surface: "#f3eadb",
    text: "#f7f1e6",
    muted: "#aaa294",
    accent: "#d5ad55",
    border: "#5d5037",
    displayFont: "cormorant-garamond",
    bodyFont: "manrope",
    spacing: "editorial",
    radius: "none",
  },
  motion: {
    preset: "soft-reveal",
    intensity: "subtle",
    parallax: "subtle",
    reducedMotionFallback: true,
  },
  sections: [
    {
      id: "cover",
      type: "cover",
      variant: "cover.editorial-split@1",
      enabled: true,
    },
    {
      id: "event",
      type: "event",
      variant: "event.editorial-cards@1",
      enabled: true,
    },
    { id: "story", type: "story", variant: "story.chapters@1", enabled: true },
    {
      id: "gallery",
      type: "gallery",
      variant: "gallery.asymmetric-grid@1",
      enabled: true,
    },
    { id: "quote", type: "quote", variant: "quote.statement@1", enabled: true },
    { id: "rsvp", type: "rsvp", variant: "rsvp.minimal@1", enabled: true },
    {
      id: "closing",
      type: "closing",
      variant: "closing.signature@1",
      enabled: true,
    },
  ],
};

export const invitationContentSchema = z.object({
  cover: z
    .object({
      secure_url: safeMediaSrc,
      focal_x: z.number().min(0).max(100),
      focal_y: z.number().min(0).max(100),
    })
    .optional(),
  couple: z.object({
    partnerOne: safeText.max(80),
    partnerTwo: safeText.max(80),
    monogram: safeText.max(8),
  }),
  opening: z.object({
    eyebrow: safeText.max(120),
    title: safeText.max(180),
    message: safeText.max(600),
  }),
  event: z.object({
    dateLabel: safeText.max(120),
    ceremonyLabel: safeText.max(80),
    ceremonyTime: safeText.max(80),
    receptionLabel: safeText.max(80),
    receptionTime: safeText.max(80),
    venue: safeText.max(180),
    address: safeText.max(300),
    mapUrl: safeUrl,
    ceremonyVenue: safeText.max(180).optional(),
    ceremonyAddress: safeText.max(300).optional(),
    ceremonyMapUrl: safeUrl.optional(),
    receptionVenue: safeText.max(180).optional(),
    receptionAddress: safeText.max(300).optional(),
    receptionMapUrl: safeUrl.optional(),
  }),
  story: z.object({
    heading: safeText.max(120),
    body: safeText,
    sectionBodies: z
      .object({
        conflict: safeText.optional(),
        final: safeText.optional(),
        intimacy: safeText.optional(),
        middle: safeText.optional(),
        trust: safeText.optional(),
      })
      .optional(),
  }),
  timeline: z
    .object({
      conflict: z.array(timelineEntrySchema).max(6).optional(),
      final: z.array(timelineEntrySchema).max(6).optional(),
      intimacy: z.array(timelineEntrySchema).max(6).optional(),
      middle: z.array(timelineEntrySchema).max(6).optional(),
      opening: z.array(timelineEntrySchema).max(6).optional(),
      trust: z.array(timelineEntrySchema).max(6).optional(),
    })
    .optional(),
  quote: z.object({
    text: safeText.max(500),
    attribution: safeText.max(120),
  }),
  gallery: z
    .array(
      z.object({
        src: safeMediaSrc,
        alt: safeText.max(180),
      }),
    )
    .min(3)
    .max(18),
  closing: z.object({
    heading: safeText.max(120),
    message: safeText.max(600),
  }),
  bank_accounts: z
    .array(
      z.object({
        bank: z.string().trim().max(80).optional(),
        name: z.string().trim().max(120).optional(),
        number: z.string().trim().max(80).optional(),
        account_number: z.string().trim().max(80).optional(),
      }),
    )
    .max(4)
    .optional(),
  bespoke: bespokeConfigSchema.optional(),
});

export type InvitationContent = z.infer<typeof invitationContentSchema>;

export const invitationEnvelopeSchema = z
  .object({
    rendererKey: rendererKeySchema,
    rendererVersion: z.number().int().positive(),
    contentSchemaVersion: z.number().int().positive(),
    locale: localeSchema,
    content: invitationContentSchema,
    guest: z
      .object({
        displayName: safeText.max(120),
      })
      .nullable()
      .optional(),
  })
  .superRefine((envelope, context) => {
    if (envelope.rendererKey === "bespoke" && !envelope.content.bespoke) {
      context.addIssue({
        code: "custom",
        message: "Bespoke renderer requires bespoke configuration",
        path: ["content", "bespoke"],
      });
    }
  });

export type InvitationEnvelope = z.infer<typeof invitationEnvelopeSchema>;

export type RendererRegistration = {
  key: RendererKey;
  version: number;
  contentSchemaVersion: number;
  supportedSections: readonly BespokeSectionType[];
};

const sections = [
  "cover",
  "event",
  "story",
  "gallery",
  "weather",
  "closing",
] as const;

export const rendererManifest: readonly RendererRegistration[] = [
  ...standardRendererKeys.flatMap((key) =>
    [1, 2].map(
      (version) =>
        ({
          key,
          version,
          contentSchemaVersion: 1,
          supportedSections: sections,
        }) satisfies RendererRegistration,
    ),
  ),
  {
    key: "bespoke",
    version: 1,
    contentSchemaVersion: 2,
    supportedSections: bespokeSectionTypes,
  },
];

export function supportsRenderer(
  key: RendererKey,
  rendererVersion: number,
  contentSchemaVersion: number,
): boolean {
  return rendererManifest.some(
    (renderer) =>
      renderer.key === key &&
      renderer.version === rendererVersion &&
      renderer.contentSchemaVersion === contentSchemaVersion,
  );
}

export function parseInvitationEnvelope(input: unknown): InvitationEnvelope {
  const envelope = invitationEnvelopeSchema.parse(input);

  if (
    !supportsRenderer(
      envelope.rendererKey,
      envelope.rendererVersion,
      envelope.contentSchemaVersion,
    )
  ) {
    throw new Error(
      `Unsupported renderer ${envelope.rendererKey}@${envelope.rendererVersion} with schema ${envelope.contentSchemaVersion}`,
    );
  }

  return envelope;
}

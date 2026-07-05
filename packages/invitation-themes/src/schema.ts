import { z } from "zod";

export const rendererKeys = [
  "elegant-classic",
  "islamic-soft",
  "luxury-gold",
  "minimalist-white",
  "dark-cinematic",
  "floral-romantic",
  "javanese-traditional",
] as const;

export const rendererKeySchema = z.enum(rendererKeys);
export type RendererKey = z.infer<typeof rendererKeySchema>;

export const localeSchema = z.enum(["id", "en"]);
export type InvitationLocale = z.infer<typeof localeSchema>;

export const packageCodes = ["essential", "signature", "couture"] as const;
export const packageCodeSchema = z.enum(packageCodes);
export type PackageCode = z.infer<typeof packageCodeSchema>;

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
  .url()
  .refine(
    (url) => {
      const protocol = new URL(url).protocol;
      return protocol === "https:" || protocol === "http:";
    },
    { message: "Only HTTP(S) URLs are allowed" },
  );

export const invitationContentSchema = z.object({
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
  }),
  story: z.object({
    heading: safeText.max(120),
    body: safeText,
  }),
  quote: z.object({
    text: safeText.max(500),
    attribution: safeText.max(120),
  }),
  gallery: z
    .array(
      z.object({
        src: z.string().startsWith("/").max(300),
        alt: safeText.max(180),
      }),
    )
    .min(3)
    .max(12),
  closing: z.object({
    heading: safeText.max(120),
    message: safeText.max(600),
  }),
});

export type InvitationContent = z.infer<typeof invitationContentSchema>;

export const invitationEnvelopeSchema = z.object({
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
});

export type InvitationEnvelope = z.infer<typeof invitationEnvelopeSchema>;

export type RendererRegistration = {
  key: RendererKey;
  version: number;
  contentSchemaVersion: number;
  supportedSections: readonly [
    "cover",
    "event",
    "story",
    "gallery",
    "weather",
    "closing",
  ];
};

const sections = [
  "cover",
  "event",
  "story",
  "gallery",
  "weather",
  "closing",
] as const;

export const rendererManifest: readonly RendererRegistration[] =
  rendererKeys.flatMap((key) =>
    [1, 2].map((version) => ({
      key,
      version,
      contentSchemaVersion: 1,
      supportedSections: sections,
    })),
  );

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

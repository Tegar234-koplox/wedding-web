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

export const invitationEnvelopeSchema = z.object({
  rendererKey: rendererKeySchema,
  rendererVersion: z.number().int().positive(),
  contentSchemaVersion: z.number().int().positive(),
  locale: z.enum(["id", "en"]),
  content: z.record(z.string(), z.unknown()),
});

export type InvitationEnvelope = z.infer<typeof invitationEnvelopeSchema>;

export type RendererRegistration = {
  key: RendererKey;
  version: number;
  contentSchemaVersion: number;
};

// Concrete renderers and curated sample content are introduced in Phase 3.
export const rendererManifest: readonly RendererRegistration[] =
  rendererKeys.map((key) => ({
    key,
    version: 1,
    contentSchemaVersion: 1,
  }));

import {
  invitationEnvelopeSchema,
  rendererKeySchema,
} from "@wedding/invitation-themes";
import { z } from "zod";

const mediaSchema = z
  .object({
    secure_url: z.url(),
    resource_type: z.enum(["image", "video", "raw"]),
    width: z.number().nullable(),
    height: z.number().nullable(),
  })
  .nullable();

export const publicThemeSchema = z.object({
  slug: rendererKeySchema,
  renderer_key: rendererKeySchema,
  renderer_version: z.number().int().positive(),
  content_schema_version: z.number().int().positive(),
  category: z.string(),
  is_featured: z.boolean(),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  feature_copy: z.array(z.string()),
  cover: mediaSchema,
});

export const publicThemePageSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(publicThemeSchema),
});

export const publicPackageSchema = z.object({
  code: z.string(),
  price: z.string(),
  currency: z.string(),
  is_featured: z.boolean(),
  name: z.string(),
  summary: z.string(),
  features: z.array(
    z.object({
      feature_key: z.string(),
      is_included: z.boolean(),
      value: z.string(),
      label: z.string(),
    }),
  ),
});

export const publicInvitationSchema = invitationEnvelopeSchema.extend({
  public_slug: z.string(),
  theme_slug: rendererKeySchema,
  package_code: z.string().nullable(),
  events: z.array(z.unknown()),
  published_at: z.string().nullable(),
});

export type PublicTheme = z.infer<typeof publicThemeSchema>;
export type PublicPackage = z.infer<typeof publicPackageSchema>;

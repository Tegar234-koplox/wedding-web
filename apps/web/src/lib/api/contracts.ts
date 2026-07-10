import {
  invitationEnvelopeSchema,
  packageCodeSchema,
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
  package_code: z.union([packageCodeSchema, z.literal("bespoke")]).nullable(),
  guest: z
    .object({
      displayName: z.string(),
    })
    .nullable(),
  audio: z
    .object({
      secure_url: z.url(),
      title: z.string(),
      loop: z.boolean(),
      default_volume: z.number().min(0).max(1),
    })
    .nullable(),
  events: z.array(z.unknown()),
  published_at: z.string().nullable(),
});

export const publicInvitationWishesSchema = z.object({
  public_slug: z.string(),
  couple_name: z.string(),
  total_invited: z.number(),
  total_confirmed: z.number(),
  total_declined: z.number(),
  total_pending: z.number(),
  response_rate: z.number(),
  wishes: z.array(
    z.object({
      display_name: z.string(),
      rsvp_status: z.string(),
      attendance_count: z.number(),
      wishes: z.string(),
      responded_at: z.string().nullable(),
    }),
  ),
});

const weatherEntrySchema = z.object({
  at: z.string(),
  local_at: z.string(),
  analysis_at: z.string(),
  temperature_c: z.number(),
  humidity_percent: z.number(),
  cloud_cover_percent: z.number(),
  precipitation_mm: z.number(),
  weather_code: z.number(),
  description: z.object({ id: z.string(), en: z.string() }),
  wind: z.object({
    speed_kmh: z.number(),
    from: z.string(),
    to: z.string(),
    degrees: z.number(),
  }),
  visibility_m: z.number(),
  visibility_text: z.string(),
});

const weatherLocationSchema = z.object({
  provider: z.string().optional(),
  adm4: z.string().optional(),
  province: z.string().optional(),
  regency: z.string().optional(),
  district: z.string().optional(),
  village: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  venue: z.string().optional(),
  address: z.string().optional(),
});

const weatherEventSchema = z.object({
  event_type: z.string().optional(),
  starts_at: z.string(),
  timezone: z.string(),
  venue: z.string(),
});

const weatherSelectionSchema = z.object({
  event: weatherEventSchema,
  location: weatherLocationSchema,
  selected: weatherEntrySchema,
  forecast: z.array(weatherEntrySchema),
});

export const invitationWeatherSchema = z.object({
  status: z.enum(["ready", "stale", "unavailable"]),
  reason: z.string().nullable().optional(),
  provider: z.literal("Open-Meteo"),
  attribution_url: z.url(),
  updated_at: z.string().nullable().optional(),
  location: weatherLocationSchema.nullable().optional(),
  event: weatherEventSchema.nullable().optional(),
  selected: weatherEntrySchema.nullable().optional(),
  forecast: z.array(weatherEntrySchema),
  selections: z.array(weatherSelectionSchema).optional(),
});

export type PublicTheme = z.infer<typeof publicThemeSchema>;
export type PublicPackage = z.infer<typeof publicPackageSchema>;
export type PublicInvitation = z.infer<typeof publicInvitationSchema>;
export type PublicInvitationWishes = z.infer<typeof publicInvitationWishesSchema>;
export type InvitationWeather = z.infer<typeof invitationWeatherSchema>;
export type InvitationAudio = NonNullable<PublicInvitation["audio"]>;

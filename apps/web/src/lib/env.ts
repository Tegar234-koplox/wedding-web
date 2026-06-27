import { z } from "zod";

function emptyToUndefined(value: string | undefined): string | undefined {
  return value?.trim() ? value : undefined;
}

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:8000/api/v1"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["id", "en"]).default("id"),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0.05),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z
    .string()
    .regex(/^\d{8,15}$/)
    .optional(),
});

export const env = publicEnvSchema.parse({
  NEXT_PUBLIC_SITE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SITE_URL),
  NEXT_PUBLIC_API_URL: emptyToUndefined(process.env.NEXT_PUBLIC_API_URL),
  NEXT_PUBLIC_DEFAULT_LOCALE: emptyToUndefined(
    process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  ),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:
    emptyToUndefined(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME),
  NEXT_PUBLIC_SENTRY_DSN: emptyToUndefined(process.env.NEXT_PUBLIC_SENTRY_DSN),
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: emptyToUndefined(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  ),
  NEXT_PUBLIC_WHATSAPP_NUMBER: emptyToUndefined(
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  ),
});

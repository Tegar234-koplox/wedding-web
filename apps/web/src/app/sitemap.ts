import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { locales } from "@/lib/locales";

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.map((locale) => ({
    url: `${env.NEXT_PUBLIC_SITE_URL}/${locale}`,
    changeFrequency: "weekly",
    priority: locale === "id" ? 1 : 0.9,
  }));
}

import type { MetadataRoute } from "next";

import { themes } from "@/content/site";
import { env } from "@/lib/env";
import { locales } from "@/lib/locales";

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) => {
    const routes = [
      { path: "", priority: locale === "id" ? 1 : 0.9 },
      { path: "/themes", priority: 0.85 },
      { path: "/packages", priority: 0.8 },
      ...themes.map((theme) => ({
        path: `/themes/${theme.slug}`,
        priority: 0.75,
      })),
    ];

    return routes.map((route) => ({
      url: `${env.NEXT_PUBLIC_SITE_URL}/${locale}${route.path}`,
      changeFrequency: "weekly" as const,
      priority: route.priority,
    }));
  });
}

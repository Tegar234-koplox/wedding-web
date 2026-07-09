const METEOCONS_CDN_BASE = "https://cdn.meteocons.com/3.0.0-next.10";

const ALLOWED_FORMATS = new Set(["svg", "svg-static", "lottie"]);
const ALLOWED_STYLES = new Set(["fill"]);
const ALLOWED_SLUGS = new Set([
  "clear-day",
  "partly-cloudy-day",
  "overcast-day",
  "fog-day",
  "rain",
  "snow",
  "thunderstorms-day-rain",
]);

function contentTypeFor(format: string) {
  if (format === "lottie") {
    return "application/json; charset=utf-8";
  }
  return "image/svg+xml; charset=utf-8";
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ format: string; slug: string; style: string }>;
  },
) {
  const { format, slug, style } = await context.params;
  const extension = format === "lottie" ? ".json" : ".svg";
  if (
    !ALLOWED_FORMATS.has(format) ||
    !ALLOWED_STYLES.has(style) ||
    !slug.endsWith(extension)
  ) {
    return new Response("Not found", { status: 404 });
  }

  const iconSlug = slug.slice(0, -extension.length);
  if (!ALLOWED_SLUGS.has(iconSlug)) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(
    `${METEOCONS_CDN_BASE}/${format}/${style}/${slug}`,
    {
      next: { revalidate: 60 * 60 * 24 * 30 },
    },
  );
  if (!upstream.ok) {
    return new Response("Icon unavailable", { status: upstream.status });
  }

  return new Response(await upstream.text(), {
    headers: {
      "Cache-Control": "public, max-age=2592000, stale-while-revalidate=604800",
      "Content-Type": contentTypeFor(format),
    },
  });
}

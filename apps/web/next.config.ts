import type { NextConfig } from "next";

const apiOrigin = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
    ).origin;
  } catch {
    return "http://localhost:8000";
  }
})();

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' " + apiOrigin,
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "frame-src 'self'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "media-src 'self' https://res.cloudinary.com",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  ...(process.env.NODE_ENV === "production"
    ? ["upgrade-insecure-requests"]
    : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@wedding/ui", "@wedding/invitation-themes"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  typedRoutes: true,
};

export default nextConfig;

import * as Sentry from "@sentry/nextjs";

const tracesSampleRate = Number(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.05",
);

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: Number.isFinite(tracesSampleRate)
    ? Math.min(Math.max(tracesSampleRate, 0), 1)
    : 0.05,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

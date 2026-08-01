import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionSecurityEnvironment } = await import(
      "./lib/security/production-startup"
    );
    assertProductionSecurityEnvironment();
    await import("./lib/server-env");
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

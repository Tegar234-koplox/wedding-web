import "server-only";

import { z } from "zod";

function emptyToUndefined(value: string | undefined): string | undefined {
  return value?.trim() ? value.trim() : undefined;
}

function isProductionDeployment(): boolean {
  return (
    process.env.DEPLOYMENT_ENVIRONMENT === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

const apiUrl = emptyToUndefined(process.env.API_URL);
const legacyApiUrl = emptyToUndefined(process.env.NEXT_PUBLIC_API_URL);
const resolvedApiUrl =
  apiUrl ??
  (!isProductionDeployment()
    ? legacyApiUrl ?? "http://localhost:8000/api/v1"
    : undefined);

export const serverEnv = {
  API_URL: z.url().parse(resolvedApiUrl),
};

import "server-only";

const ACCESS_HEADER_LINE = /^CF-Access-Client-(?:Id|Secret)\s*:/i;
const BFF_SECRET_PLACEHOLDER =
  /local-development|replace-with|change-me|changeme|do-not-use|placeholder|example|unsafe|[<>]/i;
const BFF_HEADER_NAME = "X-Niskala-BFF-Secret";

function normalizeAccessCredential(
  value: string | undefined,
  headerName: string,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const expectedHeader = new RegExp(`^${headerName}\\s*:\\s*`, "i");
  if (ACCESS_HEADER_LINE.test(trimmed) && !expectedHeader.test(trimmed)) {
    return undefined;
  }

  const normalized = trimmed.replace(expectedHeader, "").trim();
  if (!normalized || /[\r\n]/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

export function getBffSharedSecret(): string | null {
  const raw = process.env.NISKALA_BFF_SHARED_SECRET;
  const secret = raw?.trim() ?? "";
  if (
    !secret ||
    secret !== raw ||
    new TextEncoder().encode(secret).length < 32 ||
    /[^\x21-\x7e]/.test(secret) ||
    BFF_SECRET_PLACEHOLDER.test(secret) ||
    new Set(secret).size < 12
  ) {
    return null;
  }
  return secret;
}

export function getCloudflareAccessHeaders(): Record<string, string> | null {
  const rawClientId = process.env.CF_ACCESS_CLIENT_ID;
  const rawClientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  const clientId = normalizeAccessCredential(
    rawClientId,
    "CF-Access-Client-Id",
  );
  const clientSecret = normalizeAccessCredential(
    rawClientSecret,
    "CF-Access-Client-Secret",
  );
  const bffSecret = getBffSharedSecret();
  const deploymentEnvironment = process.env.DEPLOYMENT_ENVIRONMENT;
  const requiresBffSecret =
    deploymentEnvironment === "production" ||
    deploymentEnvironment === "staging" ||
    process.env.VERCEL_ENV === "production";
  if (
    (process.env.NISKALA_BFF_SHARED_SECRET?.trim() && !bffSecret) ||
    (requiresBffSecret && !bffSecret)
  ) {
    return null;
  }

  const hasConfiguredCredential = Boolean(
    rawClientId?.trim() || rawClientSecret?.trim(),
  );
  if (
    Boolean(clientId) !== Boolean(clientSecret) ||
    (hasConfiguredCredential && (!clientId || !clientSecret))
  ) {
    return null;
  }

  if (!clientId || !clientSecret) {
    const isProductionDeployment =
      process.env.DEPLOYMENT_ENVIRONMENT === "production" ||
      process.env.VERCEL_ENV === "production";
    if (isProductionDeployment) {
      return null;
    }
    return bffSecret ? { [BFF_HEADER_NAME]: bffSecret } : {};
  }

  return {
    "CF-Access-Client-Id": clientId,
    "CF-Access-Client-Secret": clientSecret,
    ...(bffSecret ? { [BFF_HEADER_NAME]: bffSecret } : {}),
  };
}

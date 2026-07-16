import "server-only";

const ACCESS_HEADER_LINE = /^CF-Access-Client-(?:Id|Secret)\s*:/i;

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
    return {};
  }

  return {
    "CF-Access-Client-Id": clientId,
    "CF-Access-Client-Secret": clientSecret,
  };
}

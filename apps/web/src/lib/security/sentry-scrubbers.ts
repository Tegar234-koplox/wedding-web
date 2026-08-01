const SENSITIVE_QUERY_VALUE = /([?&](?:preview|guest|access|token)=)[^&#\s]*/gi;
const GRANT_FRAGMENT = /#grant=[^&\s]*/gi;
const LEGACY_PATH_TOKEN =
  /(\/(?:guest-management|guest-delivery|client\/access)\/)[^/?#\s]+/gi;
const SENSITIVE_KEYS = new Set([
  "authorization",
  "access",
  "challenge",
  "code",
  "cookie",
  "csrf_token",
  "current_pin",
  "grant",
  "guest",
  "initial_pin",
  "next_pin",
  "otpauth_uri",
  "password",
  "pin",
  "preview",
  "qr_data_url",
  "recovery_code",
  "recovery_codes",
  "set_cookie",
  "signature",
  "token",
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replaceAll("-", "_");
  return (
    SENSITIVE_KEYS.has(normalized) ||
    normalized.endsWith("_pin") ||
    normalized.endsWith("_token") ||
    normalized.endsWith("_secret")
  );
}

function redactSensitiveText(value: string): string {
  return value
    .replace(SENSITIVE_QUERY_VALUE, "$1[Filtered]")
    .replace(GRANT_FRAGMENT, "#grant=[Filtered]")
    .replace(LEGACY_PATH_TOKEN, "$1[Filtered]");
}

export function stripUrlSecrets(value: string): string {
  const redacted = redactSensitiveText(value);
  const queryIndex = redacted.indexOf("?");
  const fragmentIndex = redacted.indexOf("#");
  const indexes = [queryIndex, fragmentIndex].filter((index) => index >= 0);
  return indexes.length ? redacted.slice(0, Math.min(...indexes)) : redacted;
}

function scrubValue(value: unknown, key: string, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    if (["url", "href", "from", "to"].includes(key.toLowerCase())) {
      return stripUrlSecrets(value);
    }
    return redactSensitiveText(value);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = scrubValue(value[index], key, seen);
    }
    return value;
  }
  const record = value as Record<string, unknown>;
  for (const [childKey, childValue] of Object.entries(record)) {
    if (isSensitiveKey(childKey)) {
      record[childKey] = "[Filtered]";
      continue;
    }
    if (childKey.toLowerCase() === "query_string") {
      delete record[childKey];
      continue;
    }
    record[childKey] = scrubValue(childValue, childKey, seen);
  }
  return value;
}

export function scrubSentryPayload<T>(payload: T): T {
  return scrubValue(payload, "", new WeakSet()) as T;
}

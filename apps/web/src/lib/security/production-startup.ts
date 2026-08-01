import "server-only";

import {
  getBffSharedSecret,
  getCloudflareAccessHeaders,
} from "@/lib/api/cloudflare-access";
import {
  isProductionDeployment,
  normalizeHost,
  type TrustZone,
} from "@/lib/security/trust-zones";

const HOST_VARIABLES: Record<Exclude<TrustZone, "shared">, string> = {
  public: "NISKALA_PUBLIC_HOSTS",
  client: "NISKALA_CLIENT_HOSTS",
  staff: "NISKALA_STAFF_HOSTS",
};
const DNS_HOST_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function parseProductionHosts(variableName: string): Set<string> {
  const raw = process.env[variableName]?.trim();
  if (!raw) {
    throw new Error(`${variableName} must be explicitly configured.`);
  }

  const hosts = new Set<string>();
  for (const value of raw.split(",")) {
    const candidate = value.trim();
    const normalized = normalizeHost(candidate);
    if (
      !candidate ||
      candidate.includes("*") ||
      candidate.includes(":") ||
      !normalized ||
      !DNS_HOST_PATTERN.test(normalized) ||
      normalized.endsWith(".vercel.app")
    ) {
      throw new Error(`${variableName} contains an invalid production host.`);
    }
    if (hosts.has(normalized)) {
      throw new Error(`${variableName} contains a duplicate host.`);
    }
    hosts.add(normalized);
  }
  return hosts;
}

function productionUrl(
  variableName: "API_URL" | "NEXT_PUBLIC_SITE_URL",
): URL {
  const raw = process.env[variableName]?.trim();
  let parsed: URL;
  try {
    parsed = new URL(raw ?? "");
  } catch {
    throw new Error(`${variableName} must be a valid HTTPS URL.`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`${variableName} must be a valid HTTPS URL.`);
  }
  return parsed;
}

export function assertProductionSecurityEnvironment(): void {
  if (!isProductionDeployment()) {
    return;
  }

  if (!getBffSharedSecret()) {
    throw new Error(
      "NISKALA_BFF_SHARED_SECRET must be a strong server-only secret of at least 32 bytes in production.",
    );
  }

  const accessHeaders = getCloudflareAccessHeaders();
  if (
    !accessHeaders ||
    !accessHeaders["CF-Access-Client-Id"] ||
    !accessHeaders["CF-Access-Client-Secret"]
  ) {
    throw new Error(
      "Cloudflare Access service credentials must be configured in production.",
    );
  }

  const claimedHosts = new Map<string, string>();
  const zoneHosts = new Map<string, Set<string>>();
  for (const [zone, variableName] of Object.entries(HOST_VARIABLES)) {
    const hosts = parseProductionHosts(variableName);
    zoneHosts.set(zone, hosts);
    for (const host of hosts) {
      const existingZone = claimedHosts.get(host);
      if (existingZone) {
        throw new Error(
          `Production host ${host} is assigned to both ${existingZone} and ${zone}.`,
        );
      }
      claimedHosts.set(host, zone);
    }
  }
  const apiHosts = parseProductionHosts("NISKALA_API_HOSTS");
  for (const host of apiHosts) {
    const existingZone = claimedHosts.get(host);
    if (existingZone) {
      throw new Error(
        `Production host ${host} is assigned to both ${existingZone} and api.`,
      );
    }
    claimedHosts.set(host, "api");
  }

  const publicSiteUrl = productionUrl("NEXT_PUBLIC_SITE_URL");
  const publicSiteHost = normalizeHost(publicSiteUrl.host);
  if (
    publicSiteUrl.pathname !== "/" ||
    !publicSiteHost ||
    !zoneHosts.get("public")?.has(publicSiteHost)
  ) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must use a host from NISKALA_PUBLIC_HOSTS.",
    );
  }

  const apiUrl = productionUrl("API_URL");
  if (apiUrl.pathname.replace(/\/$/, "") !== "/api/v1") {
    throw new Error("API_URL must end with /api/v1.");
  }
  const apiHost = normalizeHost(apiUrl.host);
  if (!apiHost || !apiHosts.has(apiHost)) {
    throw new Error("API_URL must use a host from NISKALA_API_HOSTS.");
  }
}

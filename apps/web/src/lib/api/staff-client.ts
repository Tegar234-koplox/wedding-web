const STAFF_API_BASE = "/api/staff";

export function staffApiPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Staff API path must start with a single slash.");
  }
  return `${STAFF_API_BASE}${path}`;
}

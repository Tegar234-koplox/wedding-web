import http from "k6/http";
import { check, sleep } from "k6";

const frontendUrl = (__ENV.K6_FRONTEND_URL || "").replace(/\/$/, "");
const apiUrl = (__ENV.K6_API_URL || "").replace(/\/$/, "");
const apiOrigin = apiUrl.replace(/\/api\/v1$/, "");
const publicSlug = __ENV.K6_PUBLIC_SLUG || "";
const previewToken = __ENV.K6_PREVIEW_TOKEN || "";
const guestToken = __ENV.K6_GUEST_TOKEN || "";

if (!frontendUrl || !apiUrl) {
  throw new Error("K6_FRONTEND_URL and K6_API_URL are required.");
}

export const options = {
  scenarios: {
    public_read: {
      executor: "constant-vus",
      vus: Number(__ENV.K6_VUS || 5),
      duration: __ENV.K6_DURATION || "2m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
    checks: ["rate>0.99"],
  },
};

function invitationUrl() {
  if (!publicSlug) {
    return `${frontendUrl}/id`;
  }
  const query = new URLSearchParams();
  if (previewToken) query.set("preview", previewToken);
  if (guestToken) query.set("guest", guestToken);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return `${frontendUrl}/id/i/${publicSlug}${suffix}`;
}

export default function () {
  const responses = http.batch([
    ["GET", `${apiOrigin}/health/live`, null, { tags: { route: "health" } }],
    ["GET", invitationUrl(), null, { tags: { route: "invitation" } }],
  ]);

  check(responses[0], {
    "health is live": (response) => response.status === 200,
  });
  check(responses[1], {
    "invitation is available": (response) =>
      response.status >= 200 && response.status < 400,
  });
  sleep(1);
}

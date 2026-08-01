# Cloudflare canonical API

The canonical production API is `https://api.niskalastudio.site`. Cloudflare
must be the only public route to Django after tunnel verification.

## Railway topology

1. Keep `wedding-api-web` on Railway private networking.
2. Add a separate `cloudflared` Railway service using the official Cloudflare image.
3. Store `TUNNEL_TOKEN` only in Railway private variables.
4. Configure tunnel ingress in Cloudflare Zero Trust:
   `api.niskalastudio.site` -> the private Railway web hostname and port.
5. Verify liveness, readiness, CSRF bootstrap, staff login, and one public invitation.
6. Confirm rollback access, then remove public networking from `wedding-api-web`.

Do not put PostgreSQL or Redis behind a public TCP proxy. They remain reachable
only through provider and private networking.

## Django and Vercel values

Railway production values must contain explicit origins only:

```text
DJANGO_ALLOWED_HOSTS=api.niskalastudio.site,healthcheck.railway.app
DJANGO_CORS_ALLOWED_ORIGINS=https://niskalastudio.site,https://client.niskalastudio.site,https://staff.niskalastudio.site
DJANGO_CSRF_TRUSTED_ORIGINS=https://niskalastudio.site,https://client.niskalastudio.site,https://staff.niskalastudio.site
DJANGO_API_DOCS_ENABLED=false
NISKALA_BFF_SHARED_SECRET=<at-least-32-random-ascii-bytes>
```

Vercel uses:

```text
API_URL=https://api.niskalastudio.site/api/v1
NISKALA_PUBLIC_HOSTS=niskalastudio.site,www.niskalastudio.site
NISKALA_CLIENT_HOSTS=client.niskalastudio.site
NISKALA_STAFF_HOSTS=staff.niskalastudio.site
NISKALA_API_HOSTS=api.niskalastudio.site
NISKALA_BFF_SHARED_SECRET=<same-value-as-railway>
CF_ACCESS_CLIENT_ID=<service-token-client-id>
CF_ACCESS_CLIENT_SECRET=<encrypted-service-token-secret>
```

The Node and Django runtimes refuse to start when the production BFF secret is
missing, shorter than 32 bytes, low-diversity, or a placeholder. Generate it
cryptographically, store the exact same value only in Vercel and Railway, and
never prefix it with `NEXT_PUBLIC_`. Rotate both deployments in one controlled
release; during a mismatched rotation Django intentionally returns a generic
non-cacheable 404 for every `/api/v1/*` request.

The Node runtime also refuses to start when the production service-token pair
is missing or the host lists are missing, wildcarded, overlapping, or point to
a Vercel default hostname. It requires HTTPS URLs, binds
`NEXT_PUBLIC_SITE_URL` to the public host allowlist, and requires `API_URL` to
end in `/api/v1`.

Preview deployments must use a staging API. Do not wildcard `*.vercel.app`
into production CORS or CSRF settings.

The BFF header is defense in depth against a bypassed Cloudflare/Railway origin;
it does not replace Cloudflare Access, WAF, the private tunnel, or host
allowlists. `/health/live` and `/health/ready` remain exempt so provider health
checks do not need the secret.

## WAF and edge limits

Enable Cloudflare managed WAF rules on the public, client, and staff hostnames
that serve the Next.js BFF, then apply route-specific rate limits there:

| Route | Limit | Action |
| --- | ---: | --- |
| Staff host: `/api/staff/auth/login` | 5 requests / 5 minutes / IP | Managed challenge, then block |
| Staff host: `/api/staff/auth/login/mfa*` | 10 requests / 5 minutes / IP | Managed challenge, then block |
| Staff host: `/api/staff/auth/csrf` | 30 requests / minute / IP | Block |
| Client host: `/api/client/redeem` and `/api/client/login/*` | 5 requests / 15 minutes / IP | Managed challenge, then block |
| Public host: `/api/guest/redeem` and `/api/preview/redeem` | 20 requests / minute / IP | Managed challenge |
| Public host: `/api/invitations/*/rsvp` | 10 requests / minute / IP | Managed challenge |
| Client/staff host: guest import paths | 5 requests / minute / IP | Block |
| Each BFF host: `/api/*` | 120 requests / minute / IP | Managed challenge |

Exclude health checks from browser challenges. Keep Cloudflare logs and alert
on sustained 429 responses, bot spikes, and origin connection failures. Do not
use browser per-IP limits on `api.<domain>`: that hostname receives Vercel
egress, so many users can share one visible source address. Django separately
limits authenticated users and hashes sensitive login/challenge/grant subjects;
it does not trust a browser-supplied forwarding header as client identity.

## Verification and rollback

Run the deployment smoke workflow against the canonical domain. Verify in
Railway logs that requests arrive through Cloudflare and that the old Railway
public hostname is no longer reachable after public networking is removed.

Rollback order: temporarily restore Railway public networking, restrict it to
operators if possible, point Vercel to the previous known-good API origin, then
repair the tunnel. Never expose PostgreSQL or Redis during rollback.

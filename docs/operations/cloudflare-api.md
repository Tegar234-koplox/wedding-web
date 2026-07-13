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
DJANGO_CORS_ALLOWED_ORIGINS=https://niskalastudio.site,https://www.niskalastudio.site
DJANGO_CSRF_TRUSTED_ORIGINS=https://niskalastudio.site,https://www.niskalastudio.site
DJANGO_API_DOCS_ENABLED=false
```

Vercel uses:

```text
NEXT_PUBLIC_API_URL=https://api.niskalastudio.site/api/v1
```

Preview deployments must use a staging API. Do not wildcard `*.vercel.app`
into production CORS or CSRF settings.

## WAF and edge limits

Enable Cloudflare managed WAF rules and apply route-specific rate limits:

| Route | Limit | Action |
| --- | ---: | --- |
| `/api/v1/auth/login` | 5 requests / 5 minutes / IP | Managed challenge, then block |
| `/api/v1/auth/csrf` | 30 requests / minute / IP | Block |
| `/api/v1/invitations/*/rsvp` | 10 requests / minute / IP | Managed challenge |
| `/api/v1/invitations/*/public-rsvp` | 10 requests / minute / IP | Managed challenge |
| `*/guest-links/import*` | 5 requests / minute / IP | Block |
| `/api/v1/*` | 120 requests / minute / IP | Managed challenge |

Exclude health checks from browser challenges. Keep Cloudflare logs and alert
on sustained 429 responses, bot spikes, and origin connection failures.

## Verification and rollback

Run the deployment smoke workflow against the canonical domain. Verify in
Railway logs that requests arrive through Cloudflare and that the old Railway
public hostname is no longer reachable after public networking is removed.

Rollback order: temporarily restore Railway public networking, restrict it to
operators if possible, point Vercel to the previous known-good API origin, then
repair the tunnel. Never expose PostgreSQL or Redis during rollback.

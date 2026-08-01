# Production deployment

This runbook prepares the selected Vercel, Railway, Neon, Cloudinary, and Sentry
topology. Provider accounts, billing, DNS changes, and production secrets remain
manual external actions.

## 1. Prerequisites

- The deployment commit is merged to `main` and CI is green.
- GitHub Dependency graph is enabled so the dependency-review job can run.
- A production domain and access to its DNS records are available.
- Vercel, Railway, Neon, Cloudinary, and Sentry projects exist under business-owned accounts.
- Two Neon connection strings are available:
  - pooled URL for application runtime as `DATABASE_URL`;
  - direct URL for migrations, backup, and restore as `DATABASE_DIRECT_URL`.

Never copy real secrets into source files, pull requests, screenshots, issue
comments, or shared chat.

## 2. Neon PostgreSQL

1. Create the production project in a region close to Railway.
2. For release v1, use the currently tested Neon runtime owner role. Do not switch
   to a restricted non-owner role during this release.
3. Copy the pooled connection string to `DATABASE_URL`.
4. Copy the direct connection string to `DATABASE_DIRECT_URL`.
5. Keep `DATABASE_DISABLE_SERVER_SIDE_CURSORS=true` for transaction-pooled connections.
6. Enable the backup or point-in-time recovery capability appropriate to the selected plan.
7. Restrict console access and require MFA for administrators.

Runtime requests use the pooled URL. Railway's pre-deploy migration command uses
`config.release`, which temporarily replaces `DATABASE_URL` with the direct URL
before Django starts.

The existing row-level-security migration is preparatory defense only: it enables
RLS but does not force it for the table owner, and the current public, capability,
and background-task paths have not been integration-tested under a restricted
runtime role. Therefore RLS is not an active production guarantee in release v1.
A separate database-hardening release must create a dedicated non-owner runtime
role, complete policies and request/task context for every access path, test them
against PostgreSQL, then enable `FORCE ROW LEVEL SECURITY`. Changing the runtime
role earlier can cause an outage without providing a verified isolation boundary.

## 3. Railway

Create one Railway project and add:

- Redis;
- `wedding-api-web`;
- `wedding-api-worker`;
- `wedding-api-beat`.

For all three application services:

1. Connect this GitHub repository.
2. Set the root directory to `/apps/api`.
3. Set the config-file path for each service:
   - web: `/infra/deployment/railway/web.toml`
   - worker: `/infra/deployment/railway/worker.toml`
   - beat: `/infra/deployment/railway/beat.toml`
4. Share the same production environment variables across the three services.
5. Keep exactly one Beat replica. Multiple Beat replicas can enqueue duplicate jobs.

The web service builds `apps/api/Dockerfile`, runs migrations through the direct
Neon URL, then starts Gunicorn on Railway's injected `PORT`. Its readiness
healthcheck is `/health/ready`. The two health endpoints are exempt from Django's
HTTPS redirect because Railway's internal healthcheck does not always include
`X-Forwarded-Proto`; all other routes remain HTTPS-only.

### Railway variables

Set these values in Railway's secret store:

```text
DJANGO_SETTINGS_MODULE=config.settings.production
DEPLOYMENT_ENVIRONMENT=production
DJANGO_SECRET_KEY=<long-random-value>
DJANGO_ALLOWED_HOSTS=api.<domain>,healthcheck.railway.app
DJANGO_CORS_ALLOWED_ORIGINS=https://<domain>,https://client.<domain>,https://staff.<domain>
DJANGO_CSRF_TRUSTED_ORIGINS=https://<domain>,https://client.<domain>,https://staff.<domain>
DJANGO_SECURE_SSL_REDIRECT=true
DJANGO_API_DOCS_ENABLED=false
DJANGO_MAX_REQUEST_BYTES=2097152
DJANGO_SESSION_COOKIE_AGE=28800
STAFF_MFA_REQUIRED=true
STAFF_MFA_CHALLENGE_TTL_SECONDS=300
STAFF_MFA_REAUTH_TTL_SECONDS=1800
STAFF_SESSION_ABSOLUTE_TTL_SECONDS=28800
STAFF_SESSION_IDLE_TTL_SECONDS=1800
STAFF_SESSION_TOUCH_INTERVAL_SECONDS=60
PUBLIC_SITE_URL=https://<domain>
CLIENT_SITE_URL=https://client.<domain>
STAFF_SITE_URL=https://staff.<domain>
PRODUCTION_EXPECTED_PUBLIC_ORIGIN=https://<domain>
PRODUCTION_EXPECTED_CLIENT_ORIGIN=https://client.<domain>
PRODUCTION_EXPECTED_STAFF_ORIGIN=https://staff.<domain>
PRODUCTION_EXPECTED_API_HOST=api.<domain>
PRODUCTION_EXPECTED_DATABASE_HOST=<neon-pooled-host>
PRODUCTION_EXPECTED_DATABASE_DIRECT_HOST=<neon-direct-host>
PRODUCTION_EXPECTED_DATABASE_NAME=<production-database-name>
PRODUCTION_EXPECTED_REDIS_HOST=<railway-redis-host>
PRODUCTION_EXPECTED_CLOUDINARY_CLOUD_NAME=<production-cloudinary-cloud-name>
CAPABILITY_KEYS_JSON={"prod-2026-01":"<at-least-32-random-bytes>"}
CAPABILITY_PRIMARY_KEY_ID=prod-2026-01
NISKALA_BFF_SHARED_SECRET=<at-least-32-random-ascii-bytes>
LEGACY_INVITATION_LINKS_ENABLED=false
LEGACY_INVITATION_LINK_CUTOFF=
DATABASE_URL=<neon-pooled-url>
DATABASE_DIRECT_URL=<neon-direct-url>
DATABASE_DISABLE_SERVER_SIDE_CURSORS=true
REDIS_URL=<railway-redis-url>
CELERY_BROKER_URL=<railway-redis-url>
CELERY_RESULT_BACKEND=<railway-redis-url>
OPEN_METEO_API_BASE_URL=https://api.open-meteo.com
OPEN_METEO_REQUEST_TIMEOUT_SECONDS=5
OPEN_METEO_CACHE_TTL_SECONDS=21600
WHATSAPP_BUSINESS_NUMBER=<digits-only>
WHATSAPP_MESSAGE_TEMPLATE_ID=<localized-template>
WHATSAPP_MESSAGE_TEMPLATE_EN=<localized-template>
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
SENTRY_DSN=<backend-dsn>
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=<git-sha-or-release>
SENTRY_TRACES_SAMPLE_RATE=0.05
WEB_CONCURRENCY=2
GUNICORN_THREADS=2
GUNICORN_TIMEOUT_SECONDS=60
```

Production refuses to boot unless MFA enforcement, explicit site origins,
production-only PostgreSQL/Redis/Cloudinary resources, bounded staff-session
TTLs, Sentry, the capability keyring, and distinct strong signing secrets are
configured. `DJANGO_SECRET_KEY` must contain at least 50 random ASCII bytes;
BFF and capability secrets require at least 32. All require sufficient character
diversity, no placeholder text, and no reuse across Django, BFF origin
authentication, or capability keys. Before deploying this release, enroll and
verify at least one active owner using the currently running release as described in
[`staff-mfa.md`](staff-mfa.md). Readiness remains `503` until at least one active
owner has confirmed TOTP. Other staff can complete the first-login MFA enrollment
flow after the hardened release is available.

The expected-origin variables are independent deployment guards. They must match
the three site URLs exactly, and `DJANGO_ALLOWED_HOSTS` may contain only the
expected API host plus Railway's health-check host. This prevents a mistyped
deployment variable from sending a capability fragment to an unrelated domain.

Migration `users.0005_staff_security_foundation` conservatively backfills every
existing active Django staff account to `owner`. Before provisioning non-owner
accounts or claiming least privilege is active, export an inventory of active
staff, downgrade each person to the required finance/editor/support/viewer role,
disable stale accounts, increment/revoke their staff session versions, and verify
each role with the dashboard smoke matrix. Keep at least one reviewed owner with
confirmed MFA and recovery access.

Generate capability-key material locally with a cryptographically secure secret
generator and store it only in Railway. To rotate, add the new key beside the
old key, change `CAPABILITY_PRIMARY_KEY_ID`, deploy, then reissue client and guest
links. Removing an old key invalidates every remaining grant or session that
depends on it, so remove it only after those links have been rotated or deliberate
revocation is acceptable.

Legacy slug/query-token links are an explicit migration bridge. Their cutoff may
not be more than 14 days in the future. Disable
`LEGACY_INVITATION_LINKS_ENABLED` after the transition window.

Cloudinary and WhatsApp values are required for their respective media/CTA
features, but an empty integration value must not prevent the API from booting.
Keep them populated before enabling production media upload workflows.

`PORT` is injected by Railway and must not be hardcoded.

After the first successful deployment, run the idempotent demo seeder only when
the production catalog is intentionally meant to start with sample data:

```text
python -m config.release seed_demo_content
```

Do not run this command if production content has already been curated separately.

## 4. Cloudinary

1. Use a production cloud separate from development where possible.
2. Configure signed uploads only; never expose the API secret to Vercel.
3. Keep the existing `themes`, `samples`, and `invitations` namespaces.
4. Restrict allowed media types, transformations, and upload sizes in Cloudinary.
5. Configure retention and backup expectations for original assets.

Only `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is public. API key and secret belong on
Railway only.

## 5. Sentry

Create separate frontend and backend projects.

- Railway receives the backend DSN through `SENTRY_DSN`.
- Vercel receives the frontend DSN through both `SENTRY_DSN` and
  `NEXT_PUBLIC_SENTRY_DSN`.
- Set `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` in Vercel so source
  maps can be uploaded during production builds.
- Keep `sendDefaultPii` disabled unless a separately reviewed privacy requirement changes it.
- Start with a `0.05` trace sample rate and adjust based on traffic and cost.

The Sentry auth token is a build secret and must never use a `NEXT_PUBLIC_` prefix.

## 6. Vercel

1. Import this GitHub repository as a new project.
2. Set Root Directory to `apps/web`.
3. Keep Framework Preset as Next.js.
4. Ensure files outside the root directory are available to the build because
   `apps/web` consumes workspace packages under `/packages`.
5. Use the commands from `apps/web/vercel.json`.
6. Configure production and preview environment values separately.

### Vercel variables

```text
NEXT_PUBLIC_SITE_URL=https://<domain>
API_URL=https://api.<domain>/api/v1
NISKALA_PUBLIC_HOSTS=<domain>,www.<domain>
NISKALA_CLIENT_HOSTS=client.<domain>
NISKALA_STAFF_HOSTS=staff.<domain>
NISKALA_API_HOSTS=api.<domain>
NISKALA_BFF_SHARED_SECRET=<same-value-as-railway>
CF_ACCESS_CLIENT_ID=<service-token-client-id>
CF_ACCESS_CLIENT_SECRET=<encrypted-service-token-secret>
NEXT_PUBLIC_DEFAULT_LOCALE=id
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<cloud-name>
NEXT_PUBLIC_WHATSAPP_NUMBER=<digits-only>
NEXT_PUBLIC_SENTRY_DSN=<frontend-dsn>
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.05
SENTRY_DSN=<frontend-dsn>
SENTRY_ORG=<organization>
SENTRY_PROJECT=<frontend-project>
SENTRY_AUTH_TOKEN=<source-map-upload-token>
SENTRY_TRACES_SAMPLE_RATE=0.05
```

All four host lists, both Cloudflare service credentials, and the server-only
BFF secret are mandatory in production. Next.js validates them during Node
runtime startup. `NISKALA_BFF_SHARED_SECRET` must match Railway exactly and must
never be exposed through `NEXT_PUBLIC_*`. Host lists must
be explicit DNS names, disjoint between zones, and must not contain wildcards,
ports, or `*.vercel.app`. `NEXT_PUBLIC_SITE_URL` and `API_URL` must use HTTPS;
the site URL host must belong to `NISKALA_PUBLIC_HOSTS`, and the API URL host
must belong to the disjoint `NISKALA_API_HOSTS` allowlist. The API URL must
end in `/api/v1`.

Preview deployments should use a non-production API or a deliberately
read-only production API policy. Do not place production backend secrets in
Vercel.

## 7. Domains, Cloudflare, and CORS

Recommended routing:

- `https://<domain>` and `https://www.<domain>` → Vercel
- `https://client.<domain>` -> Vercel client trust zone
- `https://staff.<domain>` -> Vercel staff trust zone behind Cloudflare Access
- `https://api.<domain>` -> Cloudflare Tunnel -> Railway private web service

Follow [`cloudflare-api.md`](cloudflare-api.md). Do not remove Railway public
networking until the tunnel, health checks, frontend login, and rollback path
have all been verified. Once verified, remove the public Railway origin so the
WAF cannot be bypassed.

After DNS and certificates are active:

1. update `NEXT_PUBLIC_SITE_URL`, server-only `API_URL`, and the four
   `NISKALA_*_HOSTS` allowlists;
2. update Django allowed hosts, CORS origins, and CSRF trusted origins;
3. redeploy Railway and Vercel;
4. verify that no HTTP origin remains in production variables.

## 8. Release order

1. Provision Neon, Redis, Cloudinary, and Sentry.
2. Enroll staff MFA and verify at least one active owner TOTP device.
3. Configure the three site origins, host allowlists, Cloudflare service token,
   capability keyring, and matching BFF origin secret in Vercel and Railway.
4. Deploy Railway web; its pre-deploy command applies migrations.
5. Confirm `/health/live` and `/health/ready`.
6. Deploy the Celery worker.
7. Deploy exactly one Celery Beat replica.
8. Deploy Vercel with the final API origin.
9. Attach domains and update origin allowlists.
10. Run the smoke workflow or local command:

```powershell
python infra/deployment/smoke_test.py `
  --site-url https://<domain> `
  --api-url https://api.<domain>
```

Run that command from a process where server-only
`NISKALA_BFF_SHARED_SECRET` is set. The smoke runner sends it only to the API
origin, never to the frontend origin. Store the same value as an encrypted
GitHub Actions secret for the deployment smoke workflow.

The GitHub Actions workflow `Deployment smoke test` exposes the same checks
through manual dispatch.

## 9. Release acceptance

- Vercel and all three Railway services show the expected commit SHA.
- Railway pre-deploy migrations succeeded.
- Readiness reports PostgreSQL and Redis as healthy.
- Theme and package APIs return public data without private fields.
- One sample invitation renders on mobile and desktop.
- Open-Meteo attribution appears and stale/unavailable behavior is graceful.
- WhatsApp CTA redirects to the configured number.
- Sentry receives a controlled test event from frontend and backend.
- Celery worker receives tasks and only one Beat instance schedules them.
- The smoke workflow is green.

## 10. Rollback

Roll back application services to the previous image/deployment before attempting
a database reversal. Database migrations should be backward-compatible whenever
possible. Follow
[`production-hardening.md`](production-hardening.md) for backup, restore, and
incident-response requirements.

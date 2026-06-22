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
2. Create a production database and restricted application role.
3. Copy the pooled connection string to `DATABASE_URL`.
4. Copy the direct connection string to `DATABASE_DIRECT_URL`.
5. Keep `DATABASE_DISABLE_SERVER_SIDE_CURSORS=true` for transaction-pooled connections.
6. Enable the backup or point-in-time recovery capability appropriate to the selected plan.
7. Restrict console access and require MFA for administrators.

Runtime requests use the pooled URL. Railway's pre-deploy migration command uses
`config.release`, which temporarily replaces `DATABASE_URL` with the direct URL
before Django starts.

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
DJANGO_SECRET_KEY=<long-random-value>
DJANGO_ALLOWED_HOSTS=<railway-host>,healthcheck.railway.app,api.<domain>
DJANGO_CORS_ALLOWED_ORIGINS=https://<vercel-host>,https://<domain>
DJANGO_CSRF_TRUSTED_ORIGINS=https://<vercel-host>,https://<domain>
DJANGO_SECURE_SSL_REDIRECT=true
DATABASE_URL=<neon-pooled-url>
DATABASE_DIRECT_URL=<neon-direct-url>
DATABASE_DISABLE_SERVER_SIDE_CURSORS=true
REDIS_URL=<railway-redis-url>
CELERY_BROKER_URL=<railway-redis-url>
CELERY_RESULT_BACKEND=<railway-redis-url>
BMKG_API_BASE_URL=https://api.bmkg.go.id
BMKG_REQUEST_TIMEOUT_SECONDS=5
BMKG_CACHE_TTL_SECONDS=21600
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
NEXT_PUBLIC_API_URL=https://api.<domain>/api/v1
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

Preview deployments should use a non-production API or a deliberately
read-only production API policy. Do not place production backend secrets in
Vercel.

## 7. Domains and CORS

Recommended routing:

- `https://<domain>` and `https://www.<domain>` → Vercel
- `https://api.<domain>` → Railway web service

After DNS and certificates are active:

1. update `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_API_URL`;
2. update Django allowed hosts, CORS origins, and CSRF trusted origins;
3. redeploy Railway and Vercel;
4. verify that no HTTP origin remains in production variables.

## 8. Release order

1. Provision Neon, Redis, Cloudinary, and Sentry.
2. Deploy Railway web; its pre-deploy command applies migrations.
3. Confirm `/health/live` and `/health/ready`.
4. Deploy the Celery worker.
5. Deploy exactly one Celery Beat replica.
6. Deploy Vercel with the final API origin.
7. Attach domains and update origin allowlists.
8. Run the smoke workflow or local command:

```powershell
python infra/deployment/smoke_test.py `
  --site-url https://<domain> `
  --api-url https://api.<domain>
```

The GitHub Actions workflow `Deployment smoke test` exposes the same checks
through manual dispatch.

## 9. Release acceptance

- Vercel and all three Railway services show the expected commit SHA.
- Railway pre-deploy migrations succeeded.
- Readiness reports PostgreSQL and Redis as healthy.
- Theme and package APIs return public data without private fields.
- One sample invitation renders on mobile and desktop.
- BMKG attribution appears and stale/unavailable behavior is graceful.
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

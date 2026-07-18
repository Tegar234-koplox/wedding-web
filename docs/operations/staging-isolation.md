# Isolated Staging Runbook

Staging is a separate environment, not a production deployment with a different
hostname. It must have its own frontend, API services, database, Redis,
Cloudinary account, secrets, synthetic data, and Cloudflare Access policy.

## Fixed topology

| Component | Staging target |
| --- | --- |
| Git branch | `staging` |
| Frontend | Vercel project `wedding-web-staging` |
| Frontend domain | `https://staging.niskalastudio.site` |
| Backend | Railway project `wedding-api-staging` |
| API domain | `https://api-staging.niskalastudio.site` |
| Database | Dedicated PostgreSQL/Neon database |
| Cache/queue | Dedicated Railway Redis |
| Media | Dedicated Cloudinary cloud |
| Protection | Cloudflare Access for frontend and API |

Production remains on `main`. Never attach a production database, Redis,
Cloudinary cloud, or notification destination to the staging projects.

## 1. Create provider resources

1. Create branch `staging` from the current `main` after production is stable.
2. Create Vercel project `wedding-web-staging`, set its root/build settings to
   the existing web workspace, and deploy only branch `staging`.
3. Create Railway project `wedding-api-staging` with separate API, worker, beat,
   Redis, and Cloudflare Tunnel services. Deploy code from branch `staging`.
4. Create a dedicated PostgreSQL/Neon database. Do not use another schema in
   production PostgreSQL.
5. Create a dedicated Cloudinary cloud and API credentials.
6. Route the two staging hostnames through Cloudflare. Keep API origin access
   limited to the staging tunnel.

No new application schema is required. Staging runs all migrations already
checked into the repository against the dedicated staging database.

## 2. Vercel staging variables

Set these in the staging project only:

```text
DEPLOYMENT_ENVIRONMENT=staging
NEXT_PUBLIC_SITE_URL=https://staging.niskalastudio.site
NEXT_PUBLIC_API_URL=https://api-staging.niskalastudio.site/api/v1
SENTRY_ENVIRONMENT=staging
```

`X-Niskala-Release` uses `VERCEL_GIT_COMMIT_SHA` automatically. Do not place a
Cloudflare Access service-token secret in Vercel or any `NEXT_PUBLIC_*` value.

## 3. Railway staging variables

Copy normal API variables using staging-only credentials, then set:

```text
DJANGO_SETTINGS_MODULE=config.settings.production
DEPLOYMENT_ENVIRONMENT=staging
DEPLOYMENT_RELEASE=<deployed staging commit SHA, or use Railway RAILWAY_GIT_COMMIT_SHA>
SENTRY_ENVIRONMENT=staging
DJANGO_ALLOWED_HOSTS=api-staging.niskalastudio.site,healthcheck.railway.app
DJANGO_CORS_ALLOWED_ORIGINS=https://staging.niskalastudio.site
DJANGO_CSRF_TRUSTED_ORIGINS=https://staging.niskalastudio.site
DJANGO_SESSION_COOKIE_DOMAIN=
DJANGO_CSRF_COOKIE_DOMAIN=
MIDTRANS_IS_PRODUCTION=false

STAGING_EXPECTED_FRONTEND_ORIGIN=https://staging.niskalastudio.site
STAGING_EXPECTED_API_HOST=api-staging.niskalastudio.site
STAGING_EXPECTED_DATABASE_HOST=<pooled staging database host>
STAGING_EXPECTED_DATABASE_DIRECT_HOST=<direct staging database host>
STAGING_EXPECTED_DATABASE_NAME=<staging database name>
STAGING_EXPECTED_REDIS_HOST=<staging Redis host>
STAGING_EXPECTED_CLOUDINARY_CLOUD_NAME=<staging Cloudinary cloud name>
```

The API refuses startup when any expected staging resource does not match the
effective Django configuration. The guard compares identifiers, never secret
values. Release commands temporarily use `DATABASE_DIRECT_URL`; their process
is marked as direct-database mode so the effective connection is checked against
`STAGING_EXPECTED_DATABASE_DIRECT_HOST` while normal API traffic continues to
be checked against `STAGING_EXPECTED_DATABASE_HOST`.

Set synthetic-demo secrets only on Railway staging:

```text
STAGING_DEMO_STAFF_PASSWORD=<unique staging-only password>
STAGING_DEMO_MFA_KEY=<40 hexadecimal characters / 20 bytes>
STAGING_DEMO_GUEST_TOKEN=<random staging-only guest token>
```

Configure WhatsApp/email destinations as internal test destinations. Never use
customer or guest production data.

## 4. Migrate and seed

Run in the Railway staging API service after deployment:

```powershell
python manage.py check --deploy --settings=config.settings.production
python manage.py migrate --settings=config.settings.production
python manage.py seed_staging_demo --settings=config.settings.production
```

The seed is idempotent and refuses to run unless
`DEPLOYMENT_ENVIRONMENT=staging`. It creates synthetic staff MFA, invitation,
order, event, location, and guest data using the existing models. Its isolation
marker is:

```text
Order.reference = STG-ISOLATION-CHECK
Invitation.public_slug = staging-isolation-demo
```

Verify that this marker never exists in production.

## 5. Cloudflare Access

1. Create separate Access applications for the frontend and API hostnames.
2. Allow only approved team identities.
3. Create separate service tokens for GitHub Actions and the staging frontend's
   server-to-server API requests. Restrict both tokens to the API Access
   application and keep their policies narrowly scoped.
4. Store the GitHub Actions token only in the GitHub `staging` Environment as
   `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`.
5. Store the frontend token in the Vercel staging environment as server-only
   `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` variables. Never use a
   `NEXT_PUBLIC_` prefix. The public invitation Server Components require this
   token because their API requests originate from Vercel, not the visitor's
   browser session.
6. Do not bypass Access for general API paths. Health checks used by Railway may
   be handled by private networking or a narrowly scoped origin rule.

## 6. GitHub Environment

Create GitHub Environment `staging`, enable required reviewer approval, and add:

```text
STAGING_FRONTEND_URL=https://staging.niskalastudio.site
STAGING_API_URL=https://api-staging.niskalastudio.site
STAGING_DEMO_GUEST_TOKEN=<same staging guest token>
CF_ACCESS_CLIENT_ID=<service token client id>
CF_ACCESS_CLIENT_SECRET=<service token secret>
```

The `Staging security and load assurance` workflow checks out `staging`, rejects
non-exact or production targets, verifies environment and release markers, then
runs smoke, ZAP, and k6. ZAP and k6 cannot run if isolation verification fails.

## 7. Verification and promotion

Required staging checks:

1. `/health/live` returns `environment=staging` and the deployed commit SHA.
2. Frontend responses contain matching `X-Niskala-Environment` and
   `X-Niskala-Release` headers.
3. Staff login with MFA, dashboard, preview, guest link, RSVP, CSV, media, and
   logout work with synthetic data.
4. `STG-ISOLATION-CHECK` exists only in staging.
5. ZAP baseline and k6 thresholds pass.
6. Staging migration history changes without any production migration-history
   change.

Promote only through a reviewed PR from `staging` to `main`. Record source SHA,
production SHA, deployment IDs, migrations applied, and production smoke result.
Block promotion on any 5xx, cross-environment data, identity-marker mismatch,
CORS/CSRF failure, readiness failure, or failed security/performance gate.

## Production performance gate note

The scheduled `Production performance gate` is independent of staging and uses
`PERFORMANCE_URL`. A failure on `main` must be diagnosed from the Lighthouse run
log. Typical causes are a missing URL secret or a threshold breach for LCP, CLS,
TBT, or total byte weight; do not loosen thresholds without evidence.

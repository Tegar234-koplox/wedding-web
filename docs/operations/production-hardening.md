# Production hardening

## Security baseline

- Terminate TLS at Vercel and Railway; keep Django's proxy SSL header enabled.
- Use separate production credentials for Django, PostgreSQL, Redis, Cloudinary, and Sentry.
- Keep CORS and CSRF origin lists restricted to the production frontend domains.
- Review the frontend and backend Content Security Policies whenever a new third-party origin is introduced.
- Keep public DRF serializers separate from staff serializers and preserve deny-by-default permissions.
- DRF scoped limits use Redis for login, CSRF, RSVP, and guest CSV import. They are defense-in-depth, not DDoS protection. Configure matching limits in Cloudflare.
- Staff sessions are absolute, non-rolling, expire after 12 hours, and end when the browser closes.
- Production schema and Swagger routes are disabled unless `DJANGO_API_DOCS_ENABLED=true` is set deliberately.
- Rotate secrets after staff changes, suspected exposure, or provider incidents.

## Monitoring and alerting

- Initial SLO: 99.5% monthly availability and API p95 below 500 ms, excluding
  explicitly measured third-party provider latency.
- Configure `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, and a conservative trace sample rate.
- Page the operator for 5xx above 2% for 5 minutes, readiness failure, PostgreSQL
  or Redis unavailability, deployment failure, or login failures above 20 in 5 minutes.
- Alert without paging on Celery task failures, Open-Meteo stale-cache use, API p95
  above 500 ms, and unusual 401/403/429 volume; escalate when sustained.
- Logs are JSON and include request IDs. Do not add message bodies, guest data, tokens, or full query strings to logs.
- Monitor `/health/live` for process availability and `/health/ready` for PostgreSQL and Redis readiness.
- After every deploy, run the production smoke checklist in `docs/operations/production-smoke-test.md`.

## Backup and restore

1. Enable Neon point-in-time recovery or scheduled backups appropriate to the selected plan.
2. Record Cloudinary asset public IDs in PostgreSQL; do not rely on local media directories.
3. Export a logical PostgreSQL backup before destructive migrations.
4. Restore into an isolated database first and run Django migrations plus smoke tests.
5. Verify invitation/theme counts, published invitation retrieval, weather snapshots, and media references.
6. Point a non-production API instance at the restored database before approving production recovery.

Run a documented restore rehearsal at least quarterly. A backup is not considered operational until restoration has been tested.

Review production access monthly, test MFA recovery every six months, and record
restore rehearsal evidence every quarter.

## Rollback

1. Stop the release if migrations or readiness checks fail.
2. Roll back the Vercel deployment and Railway web/worker services to the previous release.
3. Prefer forward-compatible and reversible migrations. Do not reverse a destructive migration until a verified backup exists.
4. Keep Celery Beat single-instance during rollback to avoid duplicate schedules.
5. Run health checks and smoke-test the homepage, theme catalog, invitation endpoint, WhatsApp redirect, and one published weather response.

## Incident handling

- Capture the deployment/release ID, request ID, UTC time window, and affected route.
- Revoke exposed credentials immediately; do not paste secrets into issues or chat.
- Preserve sanitized logs and provider incident references.
- Document impact, containment, recovery, and follow-up actions without claiming the service is perfectly secure.

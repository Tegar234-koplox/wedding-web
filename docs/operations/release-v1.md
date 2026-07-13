# Niskala v1 production release

## Release blockers

- Main branch CI is green and the release commit is frozen.
- Backend Ruff, Django checks, migration dry-run, and full pytest pass.
- Frontend lint, typecheck, tests, and production build pass.
- Staging uses separate PostgreSQL, Redis, Cloudinary, and credentials.
- Cloudflare canonical API, WAF, explicit CORS/CSRF, and production-off Swagger are verified.
- Database backup exists and a restore rehearsal has succeeded.
- Staff MFA rollout is complete before paid production scale.
- Playwright smoke and representative visual regression pass on the release commit.
- The latest staging ZAP and k6 workflows pass against isolated demo data.
- Restore rehearsal in [`backup-restore.md`](backup-restore.md) is evidenced.
- Incident owner and escalation path in [`incident-response.md`](incident-response.md) are assigned.

## Deployment order

1. Record release SHA and migration list.
2. Back up PostgreSQL and record restore instructions.
3. Deploy and migrate the Railway backend.
4. Verify liveness, readiness, Redis, worker, and Beat singleton.
5. Deploy Vercel with the canonical API URL.
6. Run automated deployment smoke.
7. Run the manual staging matrix in `production-smoke-test.md`.
8. Observe Sentry, JSON logs, 5xx, 401/403/429, and latency for 30 minutes.
9. Promote production and tag `v1.0.0` only after the same checks pass.

## Rollback trigger

Rollback immediately for migration failure, readiness failure, broken staff
login, cross-order data exposure, broken public invitations, repeated 5xx, or
unrecoverable RSVP/import failures. Roll back application deployments before
attempting database reversal. Never reverse a destructive migration without a
verified backup.

## Release record

Store the release tag, commit SHA, frontend deployment ID, Railway deployment
IDs, applied migrations, backup ID, smoke-test result, approver, and rollback
target in the release notes.

Phase 13 configured Bespoke remains a `v1.1.0` change. Do not merge its schema
or renderer changes into the frozen `v1.0.0` release candidate.

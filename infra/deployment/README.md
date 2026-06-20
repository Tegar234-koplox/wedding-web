# Deployment boundaries

- `apps/web` deploys to Vercel.
- `apps/api` deploys to Railway as separate web, Celery worker, and Celery Beat services.
- Production PostgreSQL is hosted on Neon.
- Production Redis is hosted on Railway.
- Cloudinary stores and transforms media.

Provisioning scripts and provider-specific configuration are deferred to Phase 7. Secrets must be configured in provider secret stores, never committed.

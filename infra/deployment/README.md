# Deployment

The production topology is:

- Vercel: `apps/web`
- Railway: Django web, Celery worker, one Celery Beat service, and Redis
- Neon: PostgreSQL
- Cloudinary: image and video storage
- Sentry: frontend, Django, and Celery error monitoring

The complete provisioning and release procedure is in
[`docs/operations/deployment.md`](../../docs/operations/deployment.md).

Configuration files:

- `railway/web.toml`: migrations, Gunicorn, and readiness healthcheck
- `railway/worker.toml`: Celery worker
- `railway/beat.toml`: singleton Celery scheduler
- `smoke_test.py`: post-deployment public smoke checks
- `validate_config.py`: CI validation for provider configuration

Production security, backup, restore, rollback, and incident handling are
documented in
[`docs/operations/production-hardening.md`](../../docs/operations/production-hardening.md).

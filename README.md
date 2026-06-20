# Wedding Web

Production-oriented monorepo for a bilingual online wedding invitation service.

## Requirements

- Node.js 24+
- pnpm 11+
- Python 3.12–3.14
- Docker Desktop (for local PostgreSQL and Redis)

## Local setup

1. Copy `.env.example` to `.env` and replace local placeholders.
2. Run `docker compose -f infra/docker-compose.yml up -d`.
3. Run `pnpm install`.
4. Create a Python virtual environment in `apps/api/.venv`.
5. Install the backend with `python -m pip install -e "apps/api[dev]"`.
6. Run migrations with `python apps/api/manage.py migrate`.
7. Start the API with `python apps/api/manage.py runserver`.
8. Start the frontend with `pnpm --filter @wedding/web dev`.

See [docs/architecture/overview.md](docs/architecture/overview.md) for boundaries and [docs/operations/local-development.md](docs/operations/local-development.md) for detailed commands.

## Phase status

Phase 1 establishes the monorepo, strict configuration, infrastructure definitions, CI, shared design tokens, and a minimal frontend/backend runtime. Product features are intentionally deferred to their roadmap phases.

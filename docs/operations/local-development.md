# Local development

## Infrastructure

Copy `.env.example` to `.env`, then start dependencies:

```powershell
docker compose -f infra/docker-compose.yml up -d
```

## Frontend

```powershell
corepack enable
pnpm install
pnpm --filter @wedding/web dev
```

## Backend

```powershell
python -m venv apps/api/.venv
apps/api/.venv/Scripts/Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e "apps/api[dev]"
python apps/api/manage.py migrate
python apps/api/manage.py seed_demo_content
python apps/api/manage.py runserver
```

Use `DJANGO_SETTINGS_MODULE=config.settings.local` for local development. Production services must use `config.settings.production`.

To test scheduled weather refreshes locally, start Redis and run:

```powershell
celery -A config worker --loglevel=INFO
celery -A config beat --loglevel=INFO
```

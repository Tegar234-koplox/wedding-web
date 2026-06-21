FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

RUN addgroup --system django && adduser --system --ingroup django django

COPY pyproject.toml ./
RUN python -m pip install --upgrade pip && python -m pip install .

COPY . .

RUN DJANGO_SETTINGS_MODULE=config.settings.base \
    DJANGO_SECRET_KEY=collectstatic-only \
    python manage.py collectstatic --noinput

RUN chown -R django:django /app

USER django

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--config", "config/gunicorn.conf.py"]

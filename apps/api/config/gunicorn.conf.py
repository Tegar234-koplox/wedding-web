from __future__ import annotations

import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
workers = int(os.environ.get("WEB_CONCURRENCY", "2"))
threads = int(os.environ.get("GUNICORN_THREADS", "2"))
timeout = int(os.environ.get("GUNICORN_TIMEOUT_SECONDS", "60"))
graceful_timeout = 30
keepalive = 5
# Gunicorn's default access format includes the raw request target, which can
# contain short-lived preview capability tokens. Structured request logging is
# handled by RequestIdMiddleware using a query-free, redacted path.
accesslog = None
errorlog = "-"
capture_output = True
worker_tmp_dir = "/dev/shm"

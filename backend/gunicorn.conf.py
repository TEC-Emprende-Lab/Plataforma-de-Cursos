"""Gunicorn settings for the certificate service container."""

from __future__ import annotations

import os


def _env_int(
    name: str,
    default: int,
    *,
    minimum: int = 1,
    maximum: int | None = None,
) -> int:
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if value < minimum or (maximum is not None and value > maximum):
        bounds = f">= {minimum}" if maximum is None else f"between {minimum} and {maximum}"
        raise RuntimeError(f"{name} must be {bounds}")
    return value


bind = f"0.0.0.0:{_env_int('PORT', 5050, maximum=65535)}"
workers = _env_int("GUNICORN_WORKERS", 1, maximum=32)
threads = _env_int("GUNICORN_THREADS", 2, maximum=32)
worker_class = "gthread"

# Certificate batches can legitimately take longer than a typical JSON route.
timeout = _env_int("GUNICORN_TIMEOUT", 120, maximum=3600)
graceful_timeout = _env_int("GUNICORN_GRACEFUL_TIMEOUT", 30, maximum=600)
keepalive = _env_int("GUNICORN_KEEPALIVE", 5, minimum=0, maximum=120)

# Recycling bounds damage from native-library leaks without restarting all
# workers simultaneously.
max_requests = _env_int("GUNICORN_MAX_REQUESTS", 1000, minimum=0)
max_requests_jitter = _env_int("GUNICORN_MAX_REQUESTS_JITTER", 100, minimum=0)

accesslog = "-"
errorlog = "-"
capture_output = True
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")

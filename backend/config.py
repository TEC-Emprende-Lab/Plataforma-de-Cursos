"""Configuración validada del servicio de certificados."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping
from urllib.parse import urlparse


def _positive_int(source: Mapping[str, str], name: str, default: int) -> int:
    try:
        value = int(source.get(name, str(default)))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


def _is_valid_cors_origin(origin: str, app_env: str) -> bool:
    parsed = urlparse(origin)
    if origin == "*" or parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False
    if parsed.path not in {"", "/"} or parsed.params or parsed.query or parsed.fragment:
        return False
    return app_env != "production" or parsed.scheme == "https"


@dataclass(frozen=True)
class AppConfig:
    app_env: str
    supabase_service_role_key: str
    max_batch_rows: int
    max_cedulas: int
    max_csv_bytes: int
    max_request_bytes: int
    rate_limit_analyze: str
    rate_limit_preview: str
    rate_limit_generate: str
    rate_limit_batch: str
    rate_limit_ai: str
    rate_limit_cedulas: str
    rate_limit_templates: str
    allowed_origins: tuple[str, ...]
    rate_storage_uri: str

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "AppConfig":
        source = os.environ if environ is None else environ
        app_env = source.get("APP_ENV", "production").strip().lower()
        if app_env not in {"production", "development", "test"}:
            raise RuntimeError("APP_ENV debe ser production, development o test")

        service_role_key = source.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        if app_env == "production" and not service_role_key:
            raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY es obligatorio en producción")

        allowed_origins = tuple(
            origin.strip()
            for origin in source.get("CORS_ALLOWED_ORIGINS", "").split(",")
            if origin.strip()
        )
        if any(not _is_valid_cors_origin(origin, app_env) for origin in allowed_origins):
            raise RuntimeError("CORS_ALLOWED_ORIGINS contiene un origen inválido")
        if not allowed_origins and app_env == "production":
            raise RuntimeError("CORS_ALLOWED_ORIGINS es obligatorio en producción")
        if not allowed_origins:
            allowed_origins = ("http://localhost:5173",)

        rate_storage_uri = source.get("RATELIMIT_STORAGE_URI", "").strip()
        if app_env == "production" and not rate_storage_uri:
            raise RuntimeError("RATELIMIT_STORAGE_URI es obligatorio en producción")
        if app_env == "production" and urlparse(rate_storage_uri).scheme not in {"redis", "rediss"}:
            raise RuntimeError("RATELIMIT_STORAGE_URI debe usar Redis en producción")

        return cls(
            app_env=app_env,
            supabase_service_role_key=service_role_key,
            max_batch_rows=_positive_int(source, "MAX_BATCH_ROWS", 200),
            max_cedulas=_positive_int(source, "MAX_CEDULAS", 200),
            max_csv_bytes=_positive_int(source, "MAX_CSV_BYTES", 1024 * 1024),
            max_request_bytes=_positive_int(source, "MAX_REQUEST_BYTES", 10 * 1024 * 1024),
            rate_limit_analyze=source.get("RATE_LIMIT_ANALYZE", "30 per minute"),
            rate_limit_preview=source.get("RATE_LIMIT_PREVIEW", "30 per minute"),
            rate_limit_generate=source.get("RATE_LIMIT_GENERATE", "10 per minute"),
            rate_limit_batch=source.get("RATE_LIMIT_BATCH", "2 per minute"),
            rate_limit_ai=source.get("RATE_LIMIT_AI", "5 per minute"),
            rate_limit_cedulas=source.get("RATE_LIMIT_CEDULAS", "10 per minute"),
            rate_limit_templates=source.get("RATE_LIMIT_TEMPLATES", "5 per minute"),
            allowed_origins=allowed_origins,
            rate_storage_uri=rate_storage_uri,
        )

import pytest

from config import AppConfig


def test_development_defaults_are_safe_and_bounded():
    config = AppConfig.from_env({"APP_ENV": "development"})

    assert config.allowed_origins == ("http://localhost:5173",)
    assert config.max_batch_rows == 200
    assert config.max_request_bytes == 10 * 1024 * 1024


def test_invalid_positive_limits_fall_back_to_defaults():
    config = AppConfig.from_env({
        "APP_ENV": "test",
        "MAX_BATCH_ROWS": "0",
        "MAX_CEDULAS": "not-a-number",
    })

    assert config.max_batch_rows == 200
    assert config.max_cedulas == 200


def test_production_requires_server_secrets_origins_and_redis():
    with pytest.raises(RuntimeError, match="SUPABASE_SERVICE_ROLE_KEY"):
        AppConfig.from_env({"APP_ENV": "production"})

    base = {
        "APP_ENV": "production",
        "SUPABASE_SERVICE_ROLE_KEY": "server-only",
        "CORS_ALLOWED_ORIGINS": "https://cursos.example.com",
    }
    with pytest.raises(RuntimeError, match="RATELIMIT_STORAGE_URI"):
        AppConfig.from_env(base)

    config = AppConfig.from_env({**base, "RATELIMIT_STORAGE_URI": "rediss://redis.example.com"})
    assert config.allowed_origins == ("https://cursos.example.com",)


def test_production_rejects_insecure_or_wildcard_origins():
    base = {
        "APP_ENV": "production",
        "SUPABASE_SERVICE_ROLE_KEY": "server-only",
        "RATELIMIT_STORAGE_URI": "redis://redis.example.com",
    }

    for origin in ("*", "http://cursos.example.com", "https://cursos.example.com/path"):
        with pytest.raises(RuntimeError, match="origen inválido"):
            AppConfig.from_env({**base, "CORS_ALLOWED_ORIGINS": origin})

from flask import Flask
from flask_limiter import Limiter

from app_factory import create_app
from config import AppConfig


def test_create_app_returns_flask_and_limiter_with_defaults():
    app, limiter = create_app(AppConfig.from_env({"APP_ENV": "test"}))

    assert isinstance(app, Flask)
    assert isinstance(limiter, Limiter)
    assert app.config["MAX_CONTENT_LENGTH"] == 10 * 1024 * 1024


def test_create_app_applies_max_content_length_from_config():
    app, _ = create_app(AppConfig.from_env({"APP_ENV": "test", "MAX_REQUEST_BYTES": "2048"}))

    assert app.config["MAX_CONTENT_LENGTH"] == 2048


def test_create_app_registers_no_business_routes_by_itself():
    app, _ = create_app(AppConfig.from_env({"APP_ENV": "test"}))

    business_rules = [rule.rule for rule in app.url_map.iter_rules() if rule.endpoint != "static"]
    assert business_rules == []


def test_create_app_supports_custom_origins_via_config():
    custom = AppConfig.from_env({"APP_ENV": "development", "CORS_ALLOWED_ORIGINS": "https://cursos.example.com"})
    app, _ = create_app(custom)

    assert app.config["MAX_CONTENT_LENGTH"] > 0
    assert custom.allowed_origins == ("https://cursos.example.com",)


def test_rate_limit_key_falls_back_to_remote_address_without_identity():
    from app_factory import _rate_limit_key
    from flask import g

    app, _ = create_app(AppConfig.from_env({"APP_ENV": "test"}))
    with app.test_request_context("/"):
        if hasattr(g, "auth_identity"):
            del g.auth_identity
        assert _rate_limit_key() is not None and _rate_limit_key() != ""

    with app.test_request_context("/"):
        g.auth_identity = type("Ident", (object,), {"subject": "user-123"})()
        assert _rate_limit_key() == "user-123"

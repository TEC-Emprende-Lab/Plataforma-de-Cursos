"""
Flask backend for certificate generation.
Endpoints:
  GET  /api/health
  GET  /api/ai/status
  POST /api/preview          — returns SVG with fields filled
  POST /api/generate         — returns PDF or PNG
  POST /api/generate/batch   — ZIP of PDFs/PNGs from CSV
  POST /api/analyze          — returns detected <text id="..."> elements
  POST /api/ai/mapeo         — AI-powered field mapping suggestion
  GET  /api/templates/<name> — serve raw SVG file
"""

import os
import logging
import uuid

from flask import request, jsonify, g
from flask_limiter.errors import RateLimitExceeded
from werkzeug.exceptions import RequestEntityTooLarge
from app_factory import create_app
from auth import AuthConfig, AuthError, SupabaseJWTVerifier
from config import AppConfig
from svg_security import PUBLIC_ERROR as SVG_PUBLIC_ERROR
from svg_security import SvgValidationError
from template_storage import (
    PUBLIC_STORAGE_ERROR,
    SupabaseTemplateStore,
    TemplateStorageError,
)
from runtime_fonts import ensure_runtime_fonts
from routes import register_routes
import runtime

APP_CONFIG = AppConfig.from_env()
APP_ENV = APP_CONFIG.app_env
AUTH_CONFIG = AuthConfig.from_env()
AUTH_VERIFIER = SupabaseJWTVerifier(AUTH_CONFIG)
logger = logging.getLogger("certificate_api")

runtime.template_store = (
    SupabaseTemplateStore(AUTH_CONFIG.supabase_url, APP_CONFIG.supabase_service_role_key)
    if AUTH_CONFIG.supabase_url and APP_CONFIG.supabase_service_role_key
    else None
)
runtime.max_batch_rows = APP_CONFIG.max_batch_rows
runtime.max_csv_bytes = APP_CONFIG.max_csv_bytes
runtime.max_cedulas = APP_CONFIG.max_cedulas
runtime.rate_limit_analyze = APP_CONFIG.rate_limit_analyze
runtime.rate_limit_preview = APP_CONFIG.rate_limit_preview
runtime.rate_limit_generate = APP_CONFIG.rate_limit_generate
runtime.rate_limit_batch = APP_CONFIG.rate_limit_batch
runtime.rate_limit_ai = APP_CONFIG.rate_limit_ai
runtime.rate_limit_cedulas = APP_CONFIG.rate_limit_cedulas
runtime.rate_limit_templates = APP_CONFIG.rate_limit_templates

app, limiter = create_app(APP_CONFIG)
ensure_runtime_fonts(app_env=APP_CONFIG.app_env)


@app.errorhandler(SvgValidationError)
def handle_invalid_svg(_error):
    return jsonify({"error": SVG_PUBLIC_ERROR, "code": "invalid_svg"}), 400


@app.errorhandler(TemplateStorageError)
def handle_template_storage_error(_error):
    logger.exception("Fallo de almacenamiento de plantilla")
    return jsonify({"error": PUBLIC_STORAGE_ERROR, "code": "template_storage_failed"}), 502


@app.before_request
def verify_protected_request():
    g.request_id = uuid.uuid4().hex
    if request.method in {"GET", "OPTIONS"}:
        return None
    g.auth_identity = AUTH_VERIFIER.verify_authorization(request.headers.get("Authorization"))
    return None


# Flask ejecuta los hooks en orden de registro: autenticación debe poblar `g`
# antes de que Flask-Limiter calcule una cuota por usuario.
limiter.init_app(app)


@app.after_request
def add_security_headers(response):
    response.headers["X-Request-ID"] = getattr(g, "request_id", uuid.uuid4().hex)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; "
        "font-src data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    )
    return response


@app.errorhandler(AuthError)
def handle_auth_error(error):
    return jsonify({"error": error.public_message, "code": error.code}), error.status_code


@app.errorhandler(RequestEntityTooLarge)
def handle_request_too_large(_error):
    return jsonify({"error": "La solicitud supera el tamaño permitido.", "code": "request_too_large"}), 413


@app.errorhandler(RateLimitExceeded)
def handle_rate_limit(_error):
    return jsonify({"error": "Demasiadas solicitudes. Intentá de nuevo más tarde.", "code": "rate_limit_exceeded"}), 429


@app.errorhandler(500)
def handle_internal_error(error):
    logger.error(
        "Error interno no controlado request_id=%s",
        getattr(g, "request_id", "unknown"),
        exc_info=error.original_exception or error,
    )
    return jsonify({
        "error": "Ocurrió un error interno.",
        "code": "internal_error",
        "request_id": getattr(g, "request_id", None),
    }), 500


register_routes(app, limiter)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5050))
    app.run(host="0.0.0.0", port=port, debug=False)

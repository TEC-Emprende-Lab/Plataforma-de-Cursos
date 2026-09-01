"""Creación y configuración de la aplicación Flask del servicio de certificados.

Este módulo construye el objeto Flask, su CORS y el Limiter, de forma
independiente de las rutas y los manejadores de errores, que se registran en
`app.py` sobre el objeto devuelto. `create_app()` no registra rutas ni
handlers para mantener un solo punto de construcción sin alterar contratos.
"""

from __future__ import annotations

from typing import Tuple

from flask import Flask, g
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from config import AppConfig


def _rate_limit_key():
    identity = getattr(g, "auth_identity", None)
    return identity.subject if identity and identity.subject else get_remote_address()


def create_app(config: AppConfig | None = None) -> Tuple[Flask, Limiter]:
    """Crea y configura la app Flask y su Limiter.

    Devuelve (app, limiter). No registra rutas ni error handlers; esos se
    asocian en `app.py` sobre el objeto devuelto, conservando el arranque
    actual (`gunicorn app:app` espera una instancia Flask en `app.py`).
    """
    cfg = config or AppConfig.from_env()

    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = cfg.max_request_bytes

    CORS(
        app,
        resources={"/api/*": {"origins": cfg.allowed_origins}},
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["X-Generated-Count", "X-Error-Count", "X-Total-Count", "Retry-After"],
        methods=["GET", "POST", "OPTIONS"],
        supports_credentials=False,
    )

    limiter = Limiter(
        key_func=_rate_limit_key,
        storage_uri=cfg.rate_storage_uri or "memory://",
        headers_enabled=True,
        default_limits=[],
    )

    return app, limiter

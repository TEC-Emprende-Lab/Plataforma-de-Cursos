"""Registro de rutas HTTP. No se invocan desde `create_app()`."""

from __future__ import annotations

from flask import Flask
from flask_limiter import Limiter


def register_routes(app: Flask, limiter: Limiter) -> None:
    from routes.health import register_health_routes
    from routes.templates import register_template_routes
    from routes.certificates import register_certificate_routes
    from routes.ai import register_ai_routes
    from routes.cedulas import register_cedula_routes

    register_health_routes(app)
    register_template_routes(app, limiter)
    register_certificate_routes(app, limiter)
    register_ai_routes(app, limiter)
    register_cedula_routes(app, limiter)

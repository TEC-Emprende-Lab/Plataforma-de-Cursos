"""Ruta de consulta de nombres por cédula."""

from __future__ import annotations

from flask import Blueprint, Flask, request
from flask_limiter import Limiter

import runtime
from routes.http import from_service_error
from services import cedulas as cedulas_service
from services.errors import ServiceError


def register_cedula_routes(app: Flask, limiter: Limiter) -> None:
    bp = Blueprint("cedulas", __name__)

    @bp.post("/api/cedulas/lookup")
    @limiter.limit(runtime.rate_limit_cedulas)
    def cedulas_lookup():
        data = request.get_json(silent=True) or {}
        try:
            return {"results": cedulas_service.lookup_many(
                data.get("cedulas", []), runtime.max_cedulas,
            )}
        except ServiceError as error:
            return from_service_error(error)

    app.register_blueprint(bp)

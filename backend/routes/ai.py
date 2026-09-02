"""Ruta de mapeo de campos SVG mediante IA."""

from __future__ import annotations

from flask import Blueprint, Flask, g, request
from flask_limiter import Limiter

import runtime
from routes.http import from_service_error
from routes.parsing import validated_svg_upload
from services import ai as ai_service
from services import svg as svg_service
from services.errors import ServiceError


def register_ai_routes(app: Flask, limiter: Limiter) -> None:
    bp = Blueprint("ai", __name__)

    @bp.post("/api/ai/mapeo")
    @limiter.limit(runtime.rate_limit_ai)
    def ai_mapeo():
        if "file" in request.files:
            svg_text = svg_service.prepare_certificate_svg(
                validated_svg_upload(request.files["file"])
            )
            elements = svg_service._detect_elements(svg_text)
        else:
            data = request.get_json(silent=True) or {}
            elements = data.get("svg_elements", [])
        try:
            return ai_service.map_svg_fields(elements, g.request_id)
        except ServiceError as error:
            return from_service_error(error)

    app.register_blueprint(bp)

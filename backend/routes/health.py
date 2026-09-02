"""Rutas públicas de estado del servicio."""

from __future__ import annotations

from flask import Blueprint, Flask, jsonify

from services import ai as ai_service
from services import svg as svg_service


def register_health_routes(app: Flask) -> None:
    bp = Blueprint("health", __name__)

    @bp.get("/api/health")
    def health():
        return jsonify({
            "status": "ok",
            "cairo": svg_service.CAIRO_OK,
            "ai": ai_service.AI_OK,
        })

    @bp.get("/api/ai/status")
    def ai_status():
        return jsonify({"available": ai_service.AI_OK})

    app.register_blueprint(bp)

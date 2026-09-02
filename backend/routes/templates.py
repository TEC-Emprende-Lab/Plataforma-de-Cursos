"""Rutas de plantillas SVG incorporadas y persistidas."""

from __future__ import annotations

import json
import re
from pathlib import Path

from flask import Blueprint, Flask, Response, jsonify, request
from flask_limiter import Limiter

import runtime
from routes.http import json_error
from routes.parsing import validated_svg_upload
from services import svg as svg_service
from svg_security import PUBLIC_ERROR as SVG_PUBLIC_ERROR
from svg_security import SvgValidationError, validate_svg


def _template_list_field(name: str, *, maximum: int) -> list[str]:
    try:
        values = json.loads(request.form.get(name, "[]"))
    except (json.JSONDecodeError, TypeError):
        values = []
    if not isinstance(values, list):
        return []
    return [str(value).strip()[:80] for value in values[:maximum] if str(value).strip()]


def register_template_routes(app: Flask, limiter: Limiter) -> None:
    bp = Blueprint("templates", __name__)

    @bp.get("/api/templates/<path:filename>")
    def serve_template(filename):
        path = svg_service.bundled_template_path(filename)
        if path is None:
            return jsonify({"error": "not found"}), 404
        try:
            svg_text = validate_svg(path.read_bytes())
        except SvgValidationError:
            return jsonify({"error": SVG_PUBLIC_ERROR, "code": "invalid_svg"}), 400
        return Response(svg_text, mimetype="image/svg+xml")

    @bp.get("/api/templates")
    def list_templates():
        return jsonify({"templates": svg_service.list_bundled_svg_names()})

    @bp.post("/api/templates/upload")
    @limiter.limit(runtime.rate_limit_templates)
    def upload_template():
        if runtime.template_store is None:
            return json_error(
                "El almacenamiento no está configurado.",
                503,
                "template_storage_unavailable",
            )
        uploaded = request.files.get("file")
        if uploaded is None or not uploaded.filename or not uploaded.filename.lower().endswith(".svg"):
            return json_error("Solo se aceptan archivos SVG.", 400, "invalid_template_file")

        svg_text = validated_svg_upload(uploaded)
        transformed = svg_service.prepare_certificate_svg(svg_text)
        elements = svg_service._detect_elements(transformed)
        detected_name = next(
            (item["id"] for item in elements if re.search(r"name|nombre|participante", item["id"], re.I)),
            None,
        )
        detected_date = next(
            (item["id"] for item in elements if re.search(r"date|fecha", item["id"], re.I)),
            None,
        )
        metadata = {
            "name": (request.form.get("name") or Path(uploaded.filename).stem)[:120],
            "file_name": Path(uploaded.filename).name[:120],
            "style": (request.form.get("style") or "Personalizado")[:80],
            "course": (request.form.get("course") or "Todos los programas")[:120],
            "colors": _template_list_field("colors", maximum=12),
            "tags": _template_list_field("tags", maximum=20),
            "name_id": (request.form.get("name_id") or detected_name or "recipient_name")[:120],
            "date_id": (request.form.get("date_id") or detected_date or "issue_date")[:120],
        }
        row = runtime.template_store.create(svg_text, uploaded.filename, metadata)
        return jsonify({"template": row}), 201

    @bp.post("/api/templates/delete")
    @limiter.limit(runtime.rate_limit_templates)
    def delete_template():
        if runtime.template_store is None:
            return json_error(
                "El almacenamiento no está configurado.",
                503,
                "template_storage_unavailable",
            )
        template_id = (request.get_json(silent=True) or {}).get("id")
        if not template_id:
            return json_error(
                "Falta el identificador de la plantilla.",
                400,
                "template_id_required",
            )
        runtime.template_store.delete(str(template_id))
        return jsonify({"deleted": True})

    app.register_blueprint(bp)

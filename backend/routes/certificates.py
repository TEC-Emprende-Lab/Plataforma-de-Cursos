"""Rutas de análisis, vista previa y generación de certificados."""

from __future__ import annotations

import json

from flask import Blueprint, Flask, Response, g, request
from flask_limiter import Limiter

import runtime
from routes.http import from_service_error, json_error, send_download
from routes.parsing import fields_from_request, load_request_svg, validated_template
from services import certificates as certificate_service
from services.errors import ServiceError
from services.svg import prepare_certificate_svg


def register_certificate_routes(app: Flask, limiter: Limiter) -> None:
    bp = Blueprint("certificates", __name__)

    @bp.post("/api/analyze")
    @limiter.limit(runtime.rate_limit_analyze)
    def analyze():
        try:
            return {"elements": certificate_service.analyze(load_request_svg())}
        except ServiceError as error:
            return from_service_error(error)

    @bp.post("/api/preview")
    @limiter.limit(runtime.rate_limit_preview)
    def preview():
        try:
            svg_text = certificate_service.preview(load_request_svg(), fields_from_request())
        except ServiceError as error:
            return from_service_error(error)
        return Response(svg_text, mimetype="image/svg+xml")

    @bp.post("/api/generate")
    @limiter.limit(runtime.rate_limit_generate)
    def generate():
        svg_text = None
        fmt = "pdf"
        fields = {}

        if request.is_json:
            data = request.get_json()
            fmt = data.get("format", data.get("output_format", "pdf")).lower()
            fields = data.get("fields", {})
            tname = data.get("template_name")
            if tname:
                svg_text = prepare_certificate_svg(validated_template(tname))
        else:
            fmt = (request.form.get("format") or request.form.get("output_format", "pdf")).lower()
            fields = fields_from_request()
            svg_text = load_request_svg(json_template=False)

        try:
            return send_download(certificate_service.generate(
                svg_text, fields, fmt, g.request_id,
            ))
        except ServiceError as error:
            return from_service_error(error)

    @bp.post("/api/generate/batch")
    @limiter.limit(runtime.rate_limit_batch)
    def generate_batch():
        fmt = (request.form.get("format") or request.form.get("output_format", "pdf")).lower()
        name_id = request.form.get("name_field_id", "recipient_name")
        date_id = request.form.get("date_field_id", "issue_date")
        global_date = request.form.get("global_date", "").strip()
        try:
            extra_fields = json.loads(request.form.get("extra_fields", "{}"))
        except (json.JSONDecodeError, ValueError):
            extra_fields = {}

        if fmt not in {"pdf", "png"}:
            return json_error("El formato debe ser PDF o PNG.", 400, "invalid_format")

        csv_text = ""
        if "csv_file" in request.files:
            csv_bytes = request.files["csv_file"].read(runtime.max_csv_bytes + 1)
            if len(csv_bytes) > runtime.max_csv_bytes:
                return json_error("El CSV supera el tamaño permitido.", 413, "csv_too_large")
            csv_text = csv_bytes.decode("utf-8-sig", errors="replace")
        else:
            csv_text = request.form.get("csv_data", "")
            if len(csv_text.encode("utf-8")) > runtime.max_csv_bytes:
                return json_error("El CSV supera el tamaño permitido.", 413, "csv_too_large")

        try:
            return send_download(certificate_service.generate_batch(
                svg_text=load_request_svg(json_template=False),
                csv_text=csv_text,
                fmt=fmt,
                name_id=name_id,
                date_id=date_id,
                global_date=global_date,
                extra_fields=extra_fields,
                request_id=g.request_id,
                max_rows=runtime.max_batch_rows,
            ))
        except ServiceError as error:
            return from_service_error(error)

    app.register_blueprint(bp)

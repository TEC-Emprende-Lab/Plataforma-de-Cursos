"""Lectura de SVG y campos desde un request Flask."""

from __future__ import annotations

import json

from flask import request

from services.svg import _load_template, prepare_certificate_svg
from svg_security import validate_svg


def validated_svg_upload(file_storage) -> str:
    return validate_svg(file_storage.read())


def validated_template(template_name: str) -> str:
    return validate_svg(_load_template(template_name))


def load_request_svg(*, json_template: bool = True) -> str | None:
    """Carga y prepara el SVG: archivo subido o plantilla nombrada.

    Valida antes de transformar. `json_template` replica analyze/preview
    (también leen `template_name` del JSON); generate/batch solo usan el form.
    """
    if "file" in request.files:
        return prepare_certificate_svg(validated_svg_upload(request.files["file"]))
    tname = request.form.get("template_name")
    if not tname and json_template:
        tname = (request.get_json(silent=True) or {}).get("template_name")
    if tname:
        return prepare_certificate_svg(validated_template(tname))
    return None


def fields_from_request() -> dict:
    try:
        fields = json.loads(request.form.get("fields", "{}"))
    except (json.JSONDecodeError, ValueError):
        fields = {}

    if not fields:
        name_id = request.form.get("name_field_id", "recipient_name")
        date_id = request.form.get("date_field_id", "issue_date")
        name_val = request.form.get("recipient_name", "")
        date_val = request.form.get("issue_date", "")
        if name_val:
            fields[name_id] = name_val
        if date_val:
            fields[date_id] = date_val
    return fields

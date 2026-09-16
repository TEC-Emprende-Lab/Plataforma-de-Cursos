"""Helpers HTTP compartidos: errores públicos y envío de archivos."""

from __future__ import annotations

import io

from flask import Response, jsonify, send_file

from services.certificates import Download
from services.errors import ServiceError


def json_error(message: str, status: int = 400, code: str | None = None, **extra):
    payload = {"error": message, **extra}
    if code:
        payload["code"] = code
    return jsonify(payload), status


def from_service_error(error: ServiceError):
    return json_error(
        error.public_message,
        error.status,
        error.code,
        **error.extra,
    )


def send_download(download: Download):
    if download.as_attachment:
        body = download.body.encode("utf-8") if isinstance(download.body, str) else download.body
        response = send_file(
            io.BytesIO(body or b""),
            mimetype=download.mimetype,
            download_name=download.filename,
            as_attachment=True,
        )
        for key, value in download.headers.items():
            response.headers[key] = value
        return response
    return Response(
        download.body,
        mimetype=download.mimetype,
        headers=download.headers or None,
    )

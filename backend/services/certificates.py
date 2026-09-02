"""Casos de uso de certificados: analizar, previsualizar y generar.

Orquesta `services.svg` y `services.csv`. No registra rutas Flask.
"""

from __future__ import annotations

import csv
import io
import logging
import re
import zipfile
from dataclasses import dataclass, field

from services import csv as csv_service
from services import svg as svg_service
from services.errors import ServiceError
from svg_security import validate_svg

logger = logging.getLogger("certificate_api")


@dataclass(frozen=True)
class Download:
    """Archivo listo para que la ruta HTTP lo envíe."""

    body: bytes | str
    mimetype: str
    filename: str | None = None
    headers: dict[str, str] = field(default_factory=dict)
    as_attachment: bool = False


def analyze(svg_text: str | None) -> list[dict]:
    if not svg_text:
        raise ServiceError("no SVG proporcionado")
    return svg_service._detect_elements(svg_text)


def preview(svg_text: str | None, fields: dict) -> str:
    if not svg_text:
        raise ServiceError("no SVG proporcionado")
    if fields:
        svg_text = svg_service._fill_svg(svg_text, fields)
    return validate_svg(svg_service._embed_fonts(svg_text))


def generate(svg_text: str | None, fields: dict, fmt: str, request_id: str) -> Download:
    if fmt not in {"pdf", "png"}:
        raise ServiceError(
            "El formato debe ser PDF o PNG.",
            code="invalid_format",
        )
    if not svg_text:
        raise ServiceError("no SVG proporcionado")

    filled = validate_svg(svg_service._fill_svg(svg_text, fields))

    if not svg_service.CAIRO_OK:
        return Download(
            body=filled,
            mimetype="image/svg+xml",
            headers={"Content-Disposition": "attachment; filename=certificado.svg"},
        )

    try:
        output = svg_service._svg_to_output(filled, fmt)
    except Exception:
        logger.exception("Fallo de generación request_id=%s", request_id)
        raise ServiceError(
            "No se pudo generar el certificado.",
            status=500,
            code="generation_failed",
            extra={"request_id": request_id},
        ) from None

    ext = "pdf" if fmt == "pdf" else "png"
    mime = "application/pdf" if fmt == "pdf" else "image/png"
    return Download(
        body=output,
        mimetype=mime,
        filename=f"certificado.{ext}",
        as_attachment=True,
    )


def generate_batch(
    *,
    svg_text: str | None,
    csv_text: str,
    fmt: str,
    name_id: str,
    date_id: str,
    global_date: str,
    extra_fields: dict,
    request_id: str,
    max_rows: int,
) -> Download:
    if fmt not in {"pdf", "png"}:
        raise ServiceError(
            "El formato debe ser PDF o PNG.",
            code="invalid_format",
        )
    if not svg_text:
        raise ServiceError("No se proporcionó plantilla SVG")

    if not csv_text.strip():
        raise ServiceError(
            "No adjuntaste ningún archivo CSV. Subí un archivo con al menos una columna de nombres y volvé a intentarlo."
        )

    rows = list(csv.DictReader(io.StringIO(csv_text)))
    if not rows:
        raise ServiceError(
            "El archivo se subió pero no tiene filas de datos. Revisá que debajo de los encabezados haya al menos una persona."
        )
    if len(rows) > max_rows:
        raise ServiceError(
            f"El lote admite como máximo {max_rows} filas.",
            code="too_many_rows",
        )

    headers = [h.strip() for h in rows[0].keys()]
    name_col = csv_service._best_column_match(headers, csv_service._FIELD_SYNONYMS["__name__"])
    if not name_col:
        cols_txt = ", ".join(f'"{h}"' for h in headers) or "(ninguna)"
        raise ServiceError(
            "No encontramos una columna con los nombres de los participantes. "
            f"Tu archivo tiene estas columnas: {cols_txt}. "
            "Renombrá una de ellas a \"nombre\" (también sirve \"name\", "
            "\"participante\" o \"estudiante\") y volvé a subirlo."
        )

    zip_buf = io.BytesIO()
    ok_count = 0
    error_count = 0

    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, row in enumerate(rows):
            fields = csv_service._resolve_fields(row, name_id, date_id)
            if global_date:
                fields[date_id] = global_date
            if extra_fields:
                fields.update(extra_fields)
            filled = validate_svg(svg_service._fill_svg(svg_text, fields))
            name_hint = fields.get(name_id) or str(i + 1)
            safe_hint = re.sub(r"[^\w\- ]", "", name_hint).strip()[:60] or str(i + 1)

            if not svg_service.CAIRO_OK:
                zf.writestr(f"{i+1:03d}_{safe_hint}.svg", filled.encode("utf-8"))
                ok_count += 1
            else:
                try:
                    output = svg_service._svg_to_output(filled, fmt)
                    ext = "pdf" if fmt == "pdf" else "png"
                    zf.writestr(f"{i+1:03d}_{safe_hint}.{ext}", output)
                    ok_count += 1
                except Exception:
                    logger.exception(
                        "Fallo de fila de lote request_id=%s row=%s", request_id, i + 1
                    )
                    zf.writestr(
                        f"{i+1:03d}_{safe_hint}_ERROR.txt",
                        b"No se pudo generar este certificado.",
                    )
                    error_count += 1

    zip_buf.seek(0)
    return Download(
        body=zip_buf.getvalue(),
        mimetype="application/zip",
        filename="certificados_lote.zip",
        as_attachment=True,
        headers={
            "X-Generated-Count": str(ok_count),
            "X-Error-Count": str(error_count),
            "X-Total-Count": str(len(rows)),
        },
    )

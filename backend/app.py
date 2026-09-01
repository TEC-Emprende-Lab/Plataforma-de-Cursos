"""
Flask backend for certificate generation.
Endpoints:
  GET  /api/health
  GET  /api/ai/status
  POST /api/preview          — returns SVG with fields filled
  POST /api/generate         — returns PDF or PNG
  POST /api/generate/batch   — ZIP of PDFs/PNGs from CSV
  POST /api/analyze          — returns detected <text id="..."> elements
  POST /api/ai/mapeo         — AI-powered field mapping suggestion
  GET  /api/templates/<name> — serve raw SVG file
"""

import io
import os
import re
import zipfile
import json
import csv
import logging
import uuid
from pathlib import Path
from xml.etree import ElementTree as ET

from flask import request, jsonify, send_file, Response, g
from flask_limiter.errors import RateLimitExceeded
from werkzeug.exceptions import RequestEntityTooLarge
from app_factory import create_app
from auth import AuthConfig, AuthError, SupabaseJWTVerifier
from services import ai as ai_service
from services import cedulas as cedulas_service
from services import csv as csv_service
from services import svg as svg_service
from config import AppConfig
from svg_security import PUBLIC_ERROR as SVG_PUBLIC_ERROR
from svg_security import SvgValidationError, validate_svg
from template_storage import (
    PUBLIC_STORAGE_ERROR,
    SupabaseTemplateStore,
    TemplateStorageError,
)

# Re-exportar símbolos de los servicios para preservar la superficie pública
# (routes y tests acceden a estos nombres vía el namespace de este módulo).
from services.ai import (AI_CLIENT, AI_OK, _fix_tildes, _NOMBRES_TILDES,
                         _tildes_cache)
from services.cedulas import _cedula_cache, _lookup_cedula
from services.csv import (_FIELD_SYNONYMS, _best_column_match,
                          _normalize_header, _resolve_fields)
from services.svg import (CAIRO_OK, TEMPLATES_DIR, _build_mixed_line,
                          _detect_elements, _embed_fonts, _fechas_parts,
                          _fill_svg, _fix_cursos_svg, _fix_image_patterns,
                          _fix_outlined_text, _format_date_es,
                          _inject_firma_yorleny, _load_template,
                          _remove_paths_by_id_keywords, _set_text_font,
                          _shift_text_y, _split_name_lines, _svg_to_output,
                          _title_case_es)

# ── Fuentes incluidas en la imagen/repositorio ───────────────────────────────
import subprocess as _sp

def _install_fonts():
    """Comprueba las fuentes sin descargar ni modificar recursos remotos."""
    try:
        result = _sp.run(["fc-list"], capture_output=True, text=True)
        fonts_list = result.stdout.lower()
        missing = [name for name in ("outfit", "onest") if name not in fonts_list]
        if missing:
            logging.getLogger(__name__).warning(
                "Fuentes esperadas no disponibles: %s", ", ".join(missing)
            )
    except Exception as e:
        logging.getLogger(__name__).warning("No se pudo comprobar fontconfig: %s", e)

_install_fonts()


def _install_repo_fonts():
    """Copia todas las fuentes incluidas en el repo (backend/fonts/*.ttf)
    al directorio de fuentes del sistema y refresca la caché de fontconfig.
    cairosvg resuelve font-family vía fontconfig, así que las fuentes deben
    estar instaladas en el sistema (no basta con el embebido base64)."""
    try:
        import os, shutil
        src_dir  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
        font_dir = "/usr/local/share/fonts/custom"
        os.makedirs(font_dir, exist_ok=True)
        if not os.path.isdir(src_dir):
            return
        for fn in os.listdir(src_dir):
            if fn.lower().endswith((".ttf", ".otf")):
                dst = os.path.join(font_dir, fn)
                if not os.path.exists(dst):
                    shutil.copy2(os.path.join(src_dir, fn), dst)
                    print(f"[fonts] {fn} copiada a {font_dir}")
        _sp.run(["fc-cache", "-f", font_dir], capture_output=True)
    except Exception as e:
        print(f"[fonts] Error copiando fuentes del repo: {e}")

_install_repo_fonts()


APP_CONFIG = AppConfig.from_env()
APP_ENV = APP_CONFIG.app_env
AUTH_CONFIG = AuthConfig.from_env()
AUTH_VERIFIER = SupabaseJWTVerifier(AUTH_CONFIG)
SUPABASE_SERVICE_ROLE_KEY = APP_CONFIG.supabase_service_role_key
TEMPLATE_STORE = (
    SupabaseTemplateStore(AUTH_CONFIG.supabase_url, SUPABASE_SERVICE_ROLE_KEY)
    if AUTH_CONFIG.supabase_url and SUPABASE_SERVICE_ROLE_KEY
    else None
)
MAX_BATCH_ROWS = APP_CONFIG.max_batch_rows
MAX_CEDULAS = APP_CONFIG.max_cedulas
MAX_CSV_BYTES = APP_CONFIG.max_csv_bytes
RATE_LIMIT_ANALYZE = APP_CONFIG.rate_limit_analyze
RATE_LIMIT_PREVIEW = APP_CONFIG.rate_limit_preview
RATE_LIMIT_GENERATE = APP_CONFIG.rate_limit_generate
RATE_LIMIT_BATCH = APP_CONFIG.rate_limit_batch
RATE_LIMIT_AI = APP_CONFIG.rate_limit_ai
RATE_LIMIT_CEDULAS = APP_CONFIG.rate_limit_cedulas
RATE_LIMIT_TEMPLATES = APP_CONFIG.rate_limit_templates
logger = logging.getLogger("certificate_api")

app, limiter = create_app(APP_CONFIG)

TEMPLATES_DIR = Path(__file__).parent / "templates"


def _validated_svg_upload(file_storage) -> str:
    return validate_svg(file_storage.read())


def _validated_template(template_name: str) -> str:
    return validate_svg(_load_template(template_name))


@app.errorhandler(SvgValidationError)
def handle_invalid_svg(_error):
    return jsonify({"error": SVG_PUBLIC_ERROR, "code": "invalid_svg"}), 400


@app.errorhandler(TemplateStorageError)
def handle_template_storage_error(_error):
    logger.exception("Fallo de almacenamiento de plantilla")
    return jsonify({"error": PUBLIC_STORAGE_ERROR, "code": "template_storage_failed"}), 502


@app.before_request
def verify_protected_request():
    g.request_id = uuid.uuid4().hex
    if request.method in {"GET", "OPTIONS"}:
        return None
    g.auth_identity = AUTH_VERIFIER.verify_authorization(request.headers.get("Authorization"))
    return None


# Flask ejecuta los hooks en orden de registro: autenticación debe poblar `g`
# antes de que Flask-Limiter calcule una cuota por usuario.
limiter.init_app(app)


@app.after_request
def add_security_headers(response):
    response.headers["X-Request-ID"] = getattr(g, "request_id", uuid.uuid4().hex)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; "
        "font-src data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    )
    return response


@app.errorhandler(AuthError)
def handle_auth_error(error):
    return jsonify({"error": error.public_message, "code": error.code}), error.status_code


@app.errorhandler(RequestEntityTooLarge)
def handle_request_too_large(_error):
    return jsonify({"error": "La solicitud supera el tamaño permitido.", "code": "request_too_large"}), 413


@app.errorhandler(RateLimitExceeded)
def handle_rate_limit(_error):
    return jsonify({"error": "Demasiadas solicitudes. Intentá de nuevo más tarde.", "code": "rate_limit_exceeded"}), 429


@app.errorhandler(500)
def handle_internal_error(error):
    logger.error(
        "Error interno no controlado request_id=%s",
        getattr(g, "request_id", "unknown"),
        exc_info=error.original_exception or error,
    )
    return jsonify({
        "error": "Ocurrió un error interno.",
        "code": "internal_error",
        "request_id": getattr(g, "request_id", None),
    }), 500

# ── routes ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "cairo": CAIRO_OK, "ai": AI_OK})


@app.get("/api/ai/status")
def ai_status():
    return jsonify({"available": AI_OK})


@app.get("/api/templates/<path:filename>")
def serve_template(filename):
    safe = Path(filename).name
    path = TEMPLATES_DIR / safe
    if not path.exists():
        return jsonify({"error": "not found"}), 404
    try:
        svg_text = validate_svg(path.read_bytes())
    except SvgValidationError:
        return jsonify({"error": SVG_PUBLIC_ERROR, "code": "invalid_svg"}), 400
    return Response(svg_text, mimetype="image/svg+xml")


@app.get("/api/templates")
def list_templates():
    files = [f.name for f in TEMPLATES_DIR.glob("*.svg")] if TEMPLATES_DIR.exists() else []
    return jsonify({"templates": files})


def _template_list_field(name: str, *, maximum: int) -> list[str]:
    try:
        values = json.loads(request.form.get(name, "[]"))
    except (json.JSONDecodeError, TypeError):
        values = []
    if not isinstance(values, list):
        return []
    return [str(value).strip()[:80] for value in values[:maximum] if str(value).strip()]


@app.post("/api/templates/upload")
@limiter.limit(RATE_LIMIT_TEMPLATES)
def upload_template():
    if TEMPLATE_STORE is None:
        return jsonify({"error": "El almacenamiento no está configurado.", "code": "template_storage_unavailable"}), 503
    uploaded = request.files.get("file")
    if uploaded is None or not uploaded.filename or not uploaded.filename.lower().endswith(".svg"):
        return jsonify({"error": "Solo se aceptan archivos SVG.", "code": "invalid_template_file"}), 400

    svg_text = _validated_svg_upload(uploaded)
    transformed = _inject_firma_yorleny(
        _fix_image_patterns(_fix_outlined_text(_fix_cursos_svg(svg_text)))
    )
    elements = _detect_elements(transformed)
    detected_name = next((item["id"] for item in elements if re.search(r"name|nombre|participante", item["id"], re.I)), None)
    detected_date = next((item["id"] for item in elements if re.search(r"date|fecha", item["id"], re.I)), None)

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
    row = TEMPLATE_STORE.create(svg_text, uploaded.filename, metadata)
    return jsonify({"template": row}), 201


@app.post("/api/templates/delete")
@limiter.limit(RATE_LIMIT_TEMPLATES)
def delete_template():
    if TEMPLATE_STORE is None:
        return jsonify({"error": "El almacenamiento no está configurado.", "code": "template_storage_unavailable"}), 503
    template_id = (request.get_json(silent=True) or {}).get("id")
    if not template_id:
        return jsonify({"error": "Falta el identificador de la plantilla.", "code": "template_id_required"}), 400
    TEMPLATE_STORE.delete(str(template_id))
    return jsonify({"deleted": True})


@app.post("/api/analyze")
@limiter.limit(RATE_LIMIT_ANALYZE)
def analyze():
    svg_text = None
    if "file" in request.files:
        svg_text = _inject_firma_yorleny(_fix_image_patterns(_fix_outlined_text(_fix_cursos_svg(_validated_svg_upload(request.files["file"])))))
    else:
        tname = request.form.get("template_name") or (request.get_json(silent=True) or {}).get("template_name")
        if tname:
            svg_text = _inject_firma_yorleny(_fix_image_patterns(_fix_outlined_text(_fix_cursos_svg(_validated_template(tname)))))
    if not svg_text:
        return jsonify({"error": "no SVG proporcionado"}), 400
    return jsonify({"elements": _detect_elements(svg_text)})


@app.post("/api/preview")
@limiter.limit(RATE_LIMIT_PREVIEW)
def preview():
    svg_text = None
    if "file" in request.files:
        svg_text = _inject_firma_yorleny(_fix_image_patterns(_fix_outlined_text(_fix_cursos_svg(_validated_svg_upload(request.files["file"])))))
    else:
        tname = request.form.get("template_name") or (request.get_json(silent=True) or {}).get("template_name")
        if tname:
            svg_text = _inject_firma_yorleny(_fix_image_patterns(_fix_outlined_text(_fix_cursos_svg(_validated_template(tname)))))
    if not svg_text:
        return jsonify({"error": "no SVG proporcionado"}), 400

    try:
        fields = json.loads(request.form.get("fields", "{}"))
    except (json.JSONDecodeError, ValueError):
        fields = {}

    if not fields:
        name_id  = request.form.get("name_field_id", "recipient_name")
        date_id  = request.form.get("date_field_id", "issue_date")
        name_val = request.form.get("recipient_name", "")
        date_val = request.form.get("issue_date", "")
        if name_val: fields[name_id] = name_val
        if date_val: fields[date_id] = date_val

    if fields:
        svg_text = _fill_svg(svg_text, fields)

    # Embeber fuentes también en la vista previa para que el navegador
    # muestre las tipografías reales (MonteCarlo, Poppins, etc.) tal como
    # saldrán en el PDF, y no una fuente de respaldo del sistema.
    svg_text = validate_svg(_embed_fonts(svg_text))

    return Response(svg_text, mimetype="image/svg+xml")


@app.post("/api/generate")
@limiter.limit(RATE_LIMIT_GENERATE)
def generate():
    svg_text = None
    fmt      = "pdf"
    fields   = {}

    if request.is_json:
        data    = request.get_json()
        fmt     = data.get("format", data.get("output_format", "pdf")).lower()
        fields  = data.get("fields", {})
        tname   = data.get("template_name")
        if tname:
            svg_text = _inject_firma_yorleny(_fix_image_patterns(_fix_outlined_text(_fix_cursos_svg(_validated_template(tname)))))
    else:
        fmt = (request.form.get("format") or request.form.get("output_format", "pdf")).lower()
        try:
            fields = json.loads(request.form.get("fields", "{}"))
        except (json.JSONDecodeError, ValueError):
            fields = {}

        if "file" in request.files:
            svg_text = _inject_firma_yorleny(_fix_image_patterns(_fix_outlined_text(_fix_cursos_svg(_validated_svg_upload(request.files["file"])))))
        else:
            tname = request.form.get("template_name")
            if tname:
                svg_text = _inject_firma_yorleny(_fix_image_patterns(_fix_outlined_text(_fix_cursos_svg(_validated_template(tname)))))

        if not fields:
            name_id  = request.form.get("name_field_id", "recipient_name")
            date_id  = request.form.get("date_field_id", "issue_date")
            name_val = request.form.get("recipient_name", "")
            date_val = request.form.get("issue_date", "")
            if name_val: fields[name_id] = name_val
            if date_val: fields[date_id] = date_val

    if fmt not in {"pdf", "png"}:
        return jsonify({"error": "El formato debe ser PDF o PNG.", "code": "invalid_format"}), 400

    if not svg_text:
        return jsonify({"error": "no SVG proporcionado"}), 400

    filled = validate_svg(_fill_svg(svg_text, fields))

    if not CAIRO_OK:
        return Response(
            filled, mimetype="image/svg+xml",
            headers={"Content-Disposition": "attachment; filename=certificado.svg"}
        )

    try:
        output = _svg_to_output(filled, fmt)
    except Exception:
        logger.exception("Fallo de generación request_id=%s", g.request_id)
        return jsonify({
            "error": "No se pudo generar el certificado.",
            "code": "generation_failed",
            "request_id": g.request_id,
        }), 500

    mime = "application/pdf" if fmt == "pdf" else "image/png"
    ext  = "pdf" if fmt == "pdf" else "png"
    return send_file(io.BytesIO(output), mimetype=mime,
                    download_name=f"certificado.{ext}", as_attachment=True)


@app.post("/api/generate/batch")
@limiter.limit(RATE_LIMIT_BATCH)
def generate_batch():
    fmt         = (request.form.get("format") or request.form.get("output_format", "pdf")).lower()
    name_id     = request.form.get("name_field_id", "recipient_name")
    date_id     = request.form.get("date_field_id", "issue_date")
    global_date = request.form.get("global_date", "").strip()
    try:
        extra_fields = json.loads(request.form.get("extra_fields", "{}"))
    except (json.JSONDecodeError, ValueError):
        extra_fields = {}

    if fmt not in {"pdf", "png"}:
        return jsonify({"error": "El formato debe ser PDF o PNG.", "code": "invalid_format"}), 400

    # Cargar SVG
    svg_text = None
    if "file" in request.files:
        svg_text = _inject_firma_yorleny(_fix_image_patterns(_fix_outlined_text(_fix_cursos_svg(_validated_svg_upload(request.files["file"])))))
    else:
        tname = request.form.get("template_name")
        if tname:
            svg_text = _inject_firma_yorleny(_fix_image_patterns(_fix_outlined_text(_fix_cursos_svg(_validated_template(tname)))))

    if not svg_text:
        return jsonify({"error": "No se proporcionó plantilla SVG"}), 400

    # Cargar CSV
    csv_text = ""
    if "csv_file" in request.files:
        csv_bytes = request.files["csv_file"].read(MAX_CSV_BYTES + 1)
        if len(csv_bytes) > MAX_CSV_BYTES:
            return jsonify({"error": "El CSV supera el tamaño permitido.", "code": "csv_too_large"}), 413
        csv_text = csv_bytes.decode("utf-8-sig", errors="replace")
    else:
        csv_text = request.form.get("csv_data", "")
        if len(csv_text.encode("utf-8")) > MAX_CSV_BYTES:
            return jsonify({"error": "El CSV supera el tamaño permitido.", "code": "csv_too_large"}), 413

    if not csv_text.strip():
        return jsonify({"error": "No adjuntaste ningún archivo CSV. Subí un archivo con al menos una columna de nombres y volvé a intentarlo."}), 400

    rows = list(csv.DictReader(io.StringIO(csv_text)))
    if not rows:
        return jsonify({"error": "El archivo se subió pero no tiene filas de datos. Revisá que debajo de los encabezados haya al menos una persona."}), 400
    if len(rows) > MAX_BATCH_ROWS:
        return jsonify({
            "error": f"El lote admite como máximo {MAX_BATCH_ROWS} filas.",
            "code": "too_many_rows",
        }), 400

    # Verificar columna de nombre con fuzzy matching (mensaje amable)
    headers = [h.strip() for h in rows[0].keys()]
    name_col = _best_column_match(headers, _FIELD_SYNONYMS["__name__"])
    if not name_col:
        cols_txt = ", ".join(f'"{h}"' for h in headers) or "(ninguna)"
        return jsonify({"error":
            "No encontramos una columna con los nombres de los participantes. "
            f"Tu archivo tiene estas columnas: {cols_txt}. "
            "Renombrá una de ellas a \"nombre\" (también sirve \"name\", "
            "\"participante\" o \"estudiante\") y volvé a subirlo."
        }), 400

    # Generar ZIP
    zip_buf     = io.BytesIO()
    ok_count    = 0
    error_count = 0

    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, row in enumerate(rows):
            fields    = _resolve_fields(row, name_id, date_id)
            if global_date:
                fields[date_id] = global_date
            if extra_fields:
                fields.update(extra_fields)
            filled    = validate_svg(_fill_svg(svg_text, fields))
            name_hint = fields.get(name_id) or str(i + 1)
            safe_hint = re.sub(r"[^\w\- ]", "", name_hint).strip()[:60] or str(i + 1)

            if not CAIRO_OK:
                zf.writestr(f"{i+1:03d}_{safe_hint}.svg", filled.encode("utf-8"))
                ok_count += 1
            else:
                try:
                    output = _svg_to_output(filled, fmt)
                    ext    = "pdf" if fmt == "pdf" else "png"
                    zf.writestr(f"{i+1:03d}_{safe_hint}.{ext}", output)
                    ok_count += 1
                except Exception:
                    logger.exception(
                        "Fallo de fila de lote request_id=%s row=%s", g.request_id, i + 1
                    )
                    zf.writestr(f"{i+1:03d}_{safe_hint}_ERROR.txt",
                                b"No se pudo generar este certificado.")
                    error_count += 1

    zip_buf.seek(0)
    resp = send_file(
        zip_buf, mimetype="application/zip",
        download_name="certificados_lote.zip", as_attachment=True
    )
    resp.headers["X-Generated-Count"] = str(ok_count)
    resp.headers["X-Error-Count"]     = str(error_count)
    resp.headers["X-Total-Count"]     = str(len(rows))
    return resp


@app.post("/api/ai/mapeo")
@limiter.limit(RATE_LIMIT_AI)
def ai_mapeo():
    if not AI_OK or not AI_CLIENT:
        return jsonify({"error": "IA no disponible — configurá ANTHROPIC_API_KEY"}), 503

    if "file" in request.files:
        svg_text = _inject_firma_yorleny(_fix_image_patterns(_fix_outlined_text(_fix_cursos_svg(_validated_svg_upload(request.files["file"])))))
        elements = _detect_elements(svg_text)
    else:
        data     = request.get_json(silent=True) or {}
        elements = data.get("svg_elements", [])

    if not elements:
        return jsonify({"error": "No se encontraron elementos con id en el SVG"}), 400

    ids   = [e["id"] for e in elements]
    texts = {e["id"]: e.get("text", "") for e in elements}

    prompt = f"""Analiza estos IDs de elementos SVG de un certificado y determina cuál es el campo del nombre del participante y cuál es la fecha.

IDs disponibles: {json.dumps(ids, ensure_ascii=False)}
Texto actual de cada ID: {json.dumps(texts, ensure_ascii=False)}

Responde SOLO con JSON, sin texto adicional:
{{
  "name_id": "el_id_del_nombre",
  "date_id": "el_id_de_la_fecha",
  "confidence": "alta|media|baja",
  "justification": "explicación breve en español"
}}"""

    try:
        # Soporte Anthropic
        if hasattr(AI_CLIENT, 'messages'):
            msg  = AI_CLIENT.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}]
            )
            text = msg.content[0].text.strip()
        else:
            # Fallback OpenAI
            resp = AI_CLIENT.chat.completions.create(
                model="gpt-4o-mini", max_tokens=256,
                messages=[{"role": "user", "content": prompt}]
            )
            text = resp.choices[0].message.content.strip()

        m = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
        if m:
            text = m.group(1)
        result = json.loads(text)
        # Validar que los IDs sugeridos existen
        if result.get("name_id") not in ids:
            result["name_id"] = ids[0] if ids else ""
        if result.get("date_id") not in ids:
            result["date_id"] = ids[1] if len(ids) > 1 else ids[0] if ids else ""
        return jsonify(result)
    except (json.JSONDecodeError, ValueError):
        logger.exception("Respuesta IA inválida request_id=%s", g.request_id)
        return jsonify({"error": "La IA devolvió una respuesta inválida.", "code": "ai_invalid_response"}), 502
    except Exception:
        logger.exception("Fallo del proveedor IA request_id=%s", g.request_id)
        return jsonify({"error": "No se pudo consultar la IA.", "code": "ai_failed"}), 502


@app.post("/api/cedulas/lookup")
@limiter.limit(RATE_LIMIT_CEDULAS)
def cedulas_lookup():
    """
    Recibe lista de cédulas y devuelve nombres oficiales del Registro Civil.
    Body JSON: {"cedulas": ["110370477", "205840321", ...]}
    Respuesta: {"results": [{"cedula": "110370477", "nombre": "JUAN PÉREZ", "ok": true}, ...]}
    """
    data = request.get_json(silent=True) or {}
    cedulas = data.get("cedulas", [])
    if not cedulas or not isinstance(cedulas, list):
        return jsonify({"error": "Enviá un JSON con campo 'cedulas' como lista"}), 400
    if len(cedulas) > MAX_CEDULAS:
        return jsonify({
            "error": f"La consulta admite como máximo {MAX_CEDULAS} cédulas.",
            "code": "too_many_cedulas",
        }), 400

    results = []
    for ced in cedulas:
        nombre = _lookup_cedula(str(ced))
        results.append({
            "cedula": str(ced),
            "nombre": nombre,
            "ok": nombre is not None
        })

    return jsonify({"results": results})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5050))
    app.run(host="0.0.0.0", port=port, debug=False)


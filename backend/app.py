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
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

from flask import Flask, request, jsonify, send_file, Response, g
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.errors import RateLimitExceeded
from flask_limiter.util import get_remote_address
from werkzeug.exceptions import RequestEntityTooLarge
from auth import AuthConfig, AuthError, SupabaseJWTVerifier
from svg_security import PUBLIC_ERROR as SVG_PUBLIC_ERROR
from svg_security import SvgValidationError, validate_svg
from template_storage import (
    PUBLIC_STORAGE_ERROR,
    SupabaseTemplateStore,
    TemplateStorageError,
)

try:
    import cairosvg
    CAIRO_OK = True
except ImportError:
    CAIRO_OK = False

# Anthropic client (preferido sobre OpenAI)
AI_CLIENT = None
AI_OK     = False
try:
    import anthropic as _anthropic
    _key = os.getenv("ANTHROPIC_API_KEY", "")
    if _key:
        AI_CLIENT = _anthropic.Anthropic(api_key=_key)
        AI_OK     = True
except (ImportError, Exception):
    pass

# Fallback a OpenAI si no hay Anthropic
if not AI_OK:
    try:
        from openai import OpenAI as _OpenAI
        _key = os.getenv("OPENAI_API_KEY", "")
        if _key:
            AI_CLIENT = _OpenAI(api_key=_key)
            AI_OK     = True
    except (ImportError, Exception):
        pass

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


def _positive_int_env(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


APP_ENV = os.getenv("APP_ENV", "production").strip().lower()
if APP_ENV not in {"production", "development", "test"}:
    raise RuntimeError("APP_ENV debe ser production, development o test")
AUTH_CONFIG = AuthConfig.from_env()
AUTH_VERIFIER = SupabaseJWTVerifier(AUTH_CONFIG)
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
if APP_ENV == "production" and not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY es obligatorio en producción")
TEMPLATE_STORE = (
    SupabaseTemplateStore(AUTH_CONFIG.supabase_url, SUPABASE_SERVICE_ROLE_KEY)
    if AUTH_CONFIG.supabase_url and SUPABASE_SERVICE_ROLE_KEY
    else None
)
MAX_BATCH_ROWS = _positive_int_env("MAX_BATCH_ROWS", 200)
MAX_CEDULAS = _positive_int_env("MAX_CEDULAS", 200)
MAX_CSV_BYTES = _positive_int_env("MAX_CSV_BYTES", 1024 * 1024)
RATE_LIMIT_ANALYZE = os.getenv("RATE_LIMIT_ANALYZE", "30 per minute")
RATE_LIMIT_PREVIEW = os.getenv("RATE_LIMIT_PREVIEW", "30 per minute")
RATE_LIMIT_GENERATE = os.getenv("RATE_LIMIT_GENERATE", "10 per minute")
RATE_LIMIT_BATCH = os.getenv("RATE_LIMIT_BATCH", "2 per minute")
RATE_LIMIT_AI = os.getenv("RATE_LIMIT_AI", "5 per minute")
RATE_LIMIT_CEDULAS = os.getenv("RATE_LIMIT_CEDULAS", "10 per minute")
RATE_LIMIT_TEMPLATES = os.getenv("RATE_LIMIT_TEMPLATES", "5 per minute")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]


def _is_valid_cors_origin(origin: str) -> bool:
    parsed = urlparse(origin)
    if origin == "*" or parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False
    if parsed.path not in {"", "/"} or parsed.params or parsed.query or parsed.fragment:
        return False
    return APP_ENV != "production" or parsed.scheme == "https"


if any(not _is_valid_cors_origin(origin) for origin in allowed_origins):
    raise RuntimeError("CORS_ALLOWED_ORIGINS contiene un origen inválido")
if not allowed_origins and APP_ENV == "production":
    raise RuntimeError("CORS_ALLOWED_ORIGINS es obligatorio en producción")
if not allowed_origins:
    allowed_origins = ["http://localhost:5173"]

rate_storage_uri = os.getenv("RATELIMIT_STORAGE_URI", "").strip()
if APP_ENV == "production" and not rate_storage_uri:
    raise RuntimeError("RATELIMIT_STORAGE_URI es obligatorio en producción")
if APP_ENV == "production" and urlparse(rate_storage_uri).scheme not in {"redis", "rediss"}:
    raise RuntimeError("RATELIMIT_STORAGE_URI debe usar Redis en producción")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = _positive_int_env("MAX_REQUEST_BYTES", 10 * 1024 * 1024)
CORS(
    app,
    resources={"/api/*": {"origins": allowed_origins}},
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Generated-Count", "X-Error-Count", "X-Total-Count", "Retry-After"],
    methods=["GET", "POST", "OPTIONS"],
    supports_credentials=False,
)


def _rate_limit_key():
    identity = getattr(g, "auth_identity", None)
    return identity.subject if identity and identity.subject else get_remote_address()


limiter = Limiter(
    key_func=_rate_limit_key,
    storage_uri=rate_storage_uri or "memory://",
    headers_enabled=True,
    default_limits=[],
)
logger = logging.getLogger("certificate_api")

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


# ── helpers ───────────────────────────────────────────────────────────────────
# Cache para no llamar la API dos veces con el mismo nombre
_tildes_cache: dict = {}

# Diccionario de nombres propios comunes con tildes correctas
_NOMBRES_TILDES = {
    # Masculinos
    "ADRIAN":"ADRIÁN","AGUSTIN":"AGUSTÍN","ANDRES":"ANDRÉS","ANGEL":"ÁNGEL",
    "ARIEL":"ARIEL","BENJAMIN":"BENJAMÍN","CAMILO":"CAMILO","CARLOS":"CARLOS",
    "CESAR":"CÉSAR","DANIEL":"DANIEL","DARIO":"DARÍO","DAVID":"DAVID",
    "DIEGO":"DIEGO","EDGAR":"ÉDGAR","EDUARDO":"EDUARDO","EMILIO":"EMILIO",
    "ENRIQUE":"ENRIQUE","ESTEBAN":"ESTEBAN","FABIAN":"FABIÁN","FELIPE":"FELIPE",
    "FRANCISCO":"FRANCISCO","GABRIEL":"GABRIEL","GERARDO":"GERARDO",
    "GONZALO":"GONZALO","GUILLERMO":"GUILLERMO","GUSTAVO":"GUSTAVO",
    "HECTOR":"HÉCTOR","HERNAN":"HERNÁN","HUGO":"HUGO","IVAN":"IVÁN",
    "JAVIER":"JAVIER","JESUS":"JESÚS","JOAQUIN":"JOAQUÍN","JORGE":"JORGE",
    "JOSE":"JOSÉ","JUAN":"JUAN","JULIAN":"JULIÁN","JULIO":"JULIO",
    "KEVIN":"KEVIN","LEONARDO":"LEONARDO","LUIS":"LUIS","MANUEL":"MANUEL",
    "MARCOS":"MARCOS","MARIO":"MARIO","MARTIN":"MARTÍN","MATEO":"MATEO",
    "MAURICIO":"MAURICIO","MIGUEL":"MIGUEL","NICOLAS":"NICOLÁS","OSCAR":"ÓSCAR",
    "PABLO":"PABLO","PEDRO":"PEDRO","RAFAEL":"RAFAEL","RAMON":"RAMÓN",
    "RAUL":"RAÚL","RICARDO":"RICARDO","ROBERTO":"ROBERTO","RODRIGO":"RODRIGO",
    "RUBEN":"RUBÉN","SAMUEL":"SAMUEL","SEBASTIAN":"SEBASTIÁN","SERGIO":"SERGIO",
    "TOMAS":"TOMÁS","VICTOR":"VÍCTOR","WILLIAM":"WILLIAM","XAVIER":"XAVIER",
    # Femeninos
    "ADRIANA":"ADRIANA","ALEJANDRA":"ALEJANDRA","ALEJANDRO":"ALEJANDRO",
    "ALICIA":"ALICIA","ANA":"ANA","ANDREA":"ANDREA","ANGELES":"ÁNGELES",
    "ANGELA":"ÁNGELA","BEATRIZ":"BEATRIZ","CAMILA":"CAMILA","CAROLINA":"CAROLINA",
    "CATALINA":"CATALINA","CLAUDIA":"CLAUDIA","CRISTINA":"CRISTINA",
    "DANIELA":"DANIELA","ELENA":"ELENA","ELIZABETH":"ELIZABETH","EVA":"EVA",
    "FERNANDA":"FERNANDA","GABRIELA":"GABRIELA","GENESIS":"GÉNESIS",
    "GLORIA":"GLORIA","ISABEL":"ISABEL","JESSICA":"JESSICA","JOHANNA":"JOHANNA",
    "JOSEFINA":"JOSEFINA","KAREN":"KAREN","KARINA":"KARINA","LAURA":"LAURA",
    "LEIDY":"LEIDY","LILIANA":"LILIANA","LORENA":"LORENA","LUCIA":"LUCÍA",
    "LUISA":"LUISA","MARCELA":"MARCELA","MARIA":"MARÍA","MARIANA":"MARIANA",
    "MELISSA":"MELISSA","MONICA":"MÓNICA","NATALIA":"NATALIA","NICOLE":"NICOLE",
    "PAOLA":"PAOLA","PATRICIA":"PATRICIA","PAULA":"PAULA","PRISCILA":"PRISCILA",
    "REBECA":"REBECA","ROSA":"ROSA","SABRINA":"SABRINA","SANDRA":"SANDRA",
    "SARA":"SARA","SILVIA":"SILVIA","SOFIA":"SOFÍA","STEFANIA":"STEFANÍA",
    "SUSANA":"SUSANA","TATIANA":"TATIANA","VALERIA":"VALERIA","VANESSA":"VANESSA",
    "VERONICA":"VERÓNICA","VIVIANA":"VIVIANA","WENDY":"WENDY","XIOMARA":"XIOMARA",
    "YORLENY":"YORLENY","YOSELYN":"YOSELYN","ZULAY":"ZULAY",
    # Apellidos comunes con tilde
    "GARCIA":"GARCÍA","GONZALEZ":"GONZÁLEZ","HERNANDEZ":"HERNÁNDEZ",
    "JIMENEZ":"JIMÉNEZ","LOPEZ":"LÓPEZ","MARTINEZ":"MARTÍNEZ","MENDEZ":"MÉNDEZ",
    "MORALES":"MORALES","NUÑEZ":"NÚÑEZ","ORDOÑEZ":"ORDÓÑEZ","PEREZ":"PÉREZ",
    "RAMIREZ":"RAMÍREZ","RODRIGUEZ":"RODRÍGUEZ","SANCHEZ":"SÁNCHEZ",
    "VASQUEZ":"VÁSQUEZ","VELASQUEZ":"VELÁSQUEZ","GUTIERREZ":"GUTIÉRREZ",
    "CASTILLO":"CASTILLO","VARGAS":"VARGAS","FLORES":"FLORES","LEON":"LEÓN",
    "CHAVEZ":"CHÁVEZ","ROMERO":"ROMERO","TORRES":"TORRES","DIAZ":"DÍAZ",
    "ALVAREZ":"ÁLVAREZ","RUIZ":"RUIZ","RAMOS":"RAMOS","REYES":"REYES",
    "CASTRO":"CASTRO","MORA":"MORA","QUESADA":"QUESADA","SOLANO":"SOLANO",
    "VEGA":"VEGA","ARAYA":"ARAYA","BRENES":"BRENES","CAMPOS":"CAMPOS",
    "CHINCHILLA":"CHINCHILLA","MONGE":"MONGE","NUNEZ":"NÚÑEZ","ALVARADO":"ALVARADO",
    "ROJAS":"ROJAS","UGALDE":"UGALDE","UREÑA":"UREÑA","ZUNIGA":"ZÚÑIGA",
}

def _fix_tildes(name: str) -> str:
    """
    Corrige tildes en nombres propios.
    Primero aplica diccionario de nombres comunes (rápido, sin costo).
    Luego usa Claude Haiku como refuerzo si la API está disponible.
    """
    name_stripped = name.strip()
    if not name_stripped:
        return name

    if name_stripped in _tildes_cache:
        return _tildes_cache[name_stripped]

    # Paso 1: diccionario — corregir palabra por palabra
    words = name_stripped.upper().split()
    corrected_words = [_NOMBRES_TILDES.get(w, w) for w in words]
    result = " ".join(corrected_words)

    # Paso 2: si la API está disponible y quedaron palabras sin tilde
    # que podrían necesitarla, refinar con Claude Haiku
    if AI_OK and AI_CLIENT and result == name_stripped.upper():
        try:
            msg = AI_CLIENT.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=60,
                messages=[{"role": "user", "content":
                    f"Corrige las tildes del siguiente nombre propio en español. "
                    f"Devolvé SOLO el nombre corregido, en mayúsculas, sin explicaciones.\n\n{result}"
                }]
            )
            api_result = msg.content[0].text.strip().upper()
            if api_result and len(api_result) <= len(result) + 10:
                result = api_result
        except Exception:
            pass

    _tildes_cache[name_stripped] = result
    return result


def _split_name_lines(name: str) -> tuple:
    """
    Divide el nombre en dos líneas equilibradas.
    Con 2+ palabras siempre divide por la mitad.
    Con 1 sola palabra devuelve (name, None).
    """
    words = name.split()
    if len(words) < 2:
        return (name, None)
    mid = len(words) // 2
    return (" ".join(words[:mid]), " ".join(words[mid:]))


def _build_mixed_line(parts, x, y, fill, font_family, font_size):
    spans = ""
    first = True
    for txt, bold in parts:
        if not txt:
            continue
        fw = "700" if bold else "400"
        if first:
            spans += f'<tspan x="{x}" y="{y}" font-weight="{fw}" xml:space="preserve">{txt}</tspan>'
            first = False
        else:
            spans += f'<tspan font-weight="{fw}" xml:space="preserve">{txt}</tspan>'
    return (
        f'<text fill="{fill}" font-family="{font_family}" font-size="{font_size}" '
        f'text-anchor="middle" style="white-space:pre" xml:space="preserve">'
        f'{spans}</text>'
    )


def _format_date_es(iso_date: str) -> str:
    """Convierte ISO (YYYY-MM-DD) a español (D de MMMM de YYYY)."""
    if not iso_date:
        return ""
    try:
        parts = iso_date.strip().split('-')
        if len(parts) != 3:
            return iso_date
        y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
        meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
                 'septiembre','octubre','noviembre','diciembre']
        return f"{d} de {meses[m-1]} de {y}"
    except:
        return iso_date


def _fechas_parts(f):
    d1 = f.get("date_issue_1", "")
    d2 = f.get("date_issue_2", "")
    if not d1 and not d2:
        raw = f.get("line_fechas", "")
        if raw:
            m = re.match(r'^Del?\s+(.+?)\s+al\s+(.+)$', raw, re.IGNORECASE)
            if m:
                d1, d2 = m.group(1).strip(), m.group(2).strip()
    # Formatear si están en ISO
    d1 = _format_date_es(d1)
    d2 = _format_date_es(d2)
    # Detectar si es Corbana (tiene ambas fechas) o cursos (tiene horas)
    has_horas = "line_horas" in f or "hours_issue" in f
    if has_horas:
        # Formato cursos: "desde el ... al ..."
        return [("desde el ", False), (d1, True), (" al ", False), (d2, True)]
    else:
        # Formato Corbana: solo fechas sin "desde el"
        return [(d1, True), (" al ", False), (d2, True)]


def _title_case_es(name: str) -> str:
    """Capitaliza un nombre tipo título en español: primera letra de cada
    palabra en mayúscula, resto en minúscula. Conserva en minúscula los
    conectores (de, del, la, las, los, y, e) salvo si son la primera palabra."""
    connectors = {"de", "del", "la", "las", "los", "y", "e", "da", "do"}
    words = name.split()
    out = []
    for i, w in enumerate(words):
        lw = w.lower()
        if i > 0 and lw in connectors:
            out.append(lw)
        else:
            out.append(lw[:1].upper() + lw[1:])
    return " ".join(out)


def _shift_text_y(svg: str, field_id: str, dy: float) -> str:
    """Desplaza verticalmente (dy px) el <text> con id dado y sus tspans,
    sumando dy a cada atributo y= dentro del elemento."""
    import re as _re
    elem_pat = _re.compile(
        r'(<text\b[^>]*\bid=["\']' + _re.escape(field_id) + r'["\'][^>]*>)([\s\S]*?)(</text>)',
        _re.IGNORECASE)

    def bump_y(s):
        def _y(mm):
            try:
                return f'y="{float(mm.group(1)) + dy:.1f}"'
            except ValueError:
                return mm.group(0)
        return _re.sub(r'y=["\']([-\d.]+)["\']', _y, s)

    def repl(m):
        return bump_y(m.group(1)) + bump_y(m.group(2)) + m.group(3)

    return elem_pat.sub(repl, svg, count=1)


def _set_text_font(svg: str, field_id: str, family: str, size=None) -> str:
    """Fuerza font-family (y font-size opcional) en el <text> completo con
    id dado. Modifica el tag de apertura y limpia font-family/font-size de
    los <tspan> hijos para que no sobrescriban los valores del <text>."""
    import re as _re
    elem_pat = _re.compile(
        r'(<text\b[^>]*\bid=["\']' + _re.escape(field_id) + r'["\'][^>]*>)([\s\S]*?)(</text>)',
        _re.IGNORECASE)

    def repl(m):
        open_tag, inner, close_tag = m.group(1), m.group(2), m.group(3)

        # font-family en el tag de apertura
        if _re.search(r'font-family=', open_tag, _re.IGNORECASE):
            open_tag = _re.sub(r'font-family=["\'][^"\']*["\']',
                               f'font-family="{family}"', open_tag, count=1, flags=_re.IGNORECASE)
        else:
            open_tag = open_tag[:-1] + f' font-family="{family}">'

        if size is not None:
            if _re.search(r'font-size=', open_tag, _re.IGNORECASE):
                open_tag = _re.sub(r'font-size=["\'][^"\']*["\']',
                                   f'font-size="{size}"', open_tag, count=1, flags=_re.IGNORECASE)
            else:
                open_tag = open_tag[:-1] + f' font-size="{size}">'

        # Limpiar font-family/size de los tspans hijos para que herede del <text>
        inner = _re.sub(r'\s*font-family=["\'][^"\']*["\']', '', inner, flags=_re.IGNORECASE)
        inner = _re.sub(r'\s*font-size=["\'][^"\']*["\']',   '', inner, flags=_re.IGNORECASE)

        return open_tag + inner + close_tag

    return elem_pat.sub(repl, svg, count=1)


def _fill_svg(svg_text: str, fields: dict) -> str:
    import re as _re
    result = svg_text
    DEFAULT_LINE_HEIGHT = 44

    # ── Tipografía específica de Corbana ──────────────────────────
    # recipient_name → MonteCarlo 45; fechas (line_fechas) y otorgación
    # (issue_date) → Poppins 12. Solo aplica a la plantilla de Corbana,
    # detectada por la palabra "corbana" o por tener line_fechas sin
    # los marcadores del certificado de cursos.
    _low = svg_text.lower()
    _is_corbana = (
        "corbana" in _low
        or ("line_fechas" in _low and "line_curso" not in _low
            and "line_horas" not in _low and "course_name" not in _low)
    )
    if _is_corbana:
        result = _set_text_font(result, "recipient_name", "MonteCarlo", 45)
        result = _set_text_font(result, "line_fechas",   "Poppins",    12)
        result = _set_text_font(result, "issue_date",    "Poppins",    12)
        # Bajar un poco la fecha de otorgación para separarla del texto superior
        result = _shift_text_y(result, "issue_date", 14)

    # ── Tipografía específica del certificado de Cursos ───────────
    # Todo en Sen: nombre 32 (en dos líneas), resto 14.
    _is_cursos = (
        "line_curso" in _low or "line_horas" in _low or "course_name" in _low
    )
    if _is_cursos:
        result = _set_text_font(result, "recipient_name", "Sen", 32)
        result = _set_text_font(result, "line_curso",     "Sen", 14)
        result = _set_text_font(result, "line_horas",     "Sen", 14)
        result = _set_text_font(result, "line_fechas",    "Sen", 14)
        result = _set_text_font(result, "issue_date",     "Sen", 14)

    MIXED_LINES = {
        "line_curso": lambda f: [
            ("Por haber concluido con exito el ", False),
            (f.get("course_name_1") or f.get("line_curso", ""), True),
        ],
        "line_horas": lambda f: [
            (f.get("course_name_2", ""), True),
            (" con un total de ", False),
            (f.get("hours_issue") or f.get("line_horas", ""), True),
            (" impartidas", False),
        ],
        "line_fechas": _fechas_parts,
    }

    processed_mixed = set()

    for line_id, parts_fn in MIXED_LINES.items():
        # Soporta tanto id="..." como id='...'
        pat = r'<text[^>]*id=["\']' + _re.escape(line_id) + r'["\'][\s\S]*?</text>'
        m = _re.search(pat, result, _re.IGNORECASE)
        if not m:
            continue
        tag = m.group(0)
        parts = parts_fn(fields)
        safe_parts = [
            (txt.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;"), bold)
            for txt, bold in parts
        ]

        # Extraer x/y del primer tspan; si no hay, del propio <text>
        x_m = (_re.search(r'<tspan[^>]*\bx=["\']([^"\']+)["\']', tag) or
               _re.search(r'<text\b[^>]*\bx=["\']([^"\']+)["\']', tag))
        y_m = (_re.search(r'<tspan[^>]*\by=["\']([^"\']+)["\']', tag) or
               _re.search(r'<text\b[^>]*\by=["\']([^"\']+)["\']', tag))

        # Concatenar todas las partes en un solo tspan.
        # cairosvg aplica text-anchor="middle" a cada tspan por separado,
        # lo que causa superposición cuando hay múltiples tspans sin x/y.
        combined = "".join(txt for txt, _ in safe_parts if txt)
        if not combined:
            continue
        pos = ""
        if x_m: pos += f' x="{x_m.group(1)}"'
        if y_m: pos += f' y="{y_m.group(1)}"'
        spans = f'<tspan{pos}>{combined}</tspan>'

        # Preservar el tag de apertura original (mantiene fill, font, transform, etc.)
        open_m = _re.match(r'(<text\b[^>]*>)', tag)
        if open_m:
            new_tag = open_m.group(1) + spans + '</text>'
            result = result.replace(tag, new_tag, 1)
            processed_mixed.add(line_id)

    for field_id, value in fields.items():
        if not field_id or value is None:
            continue
        if field_id in processed_mixed:
            continue
        raw_val = str(value)
        if field_id == "recipient_name":
            raw_val = _fix_tildes(raw_val)
            # Corbana y Cursos: el nombre se capitaliza tipo título
            # (Federico Ayuso Rodríguez) en lugar de ir todo en mayúsculas.
            if _is_corbana or _is_cursos:
                raw_val = _title_case_es(raw_val)

        # Nombre en dos líneas (nombres / apellidos). Aplica a FIDEIMAS
        # (detectada por la palabra "fideimas") y al certificado de cursos
        # (detectado por line_curso / line_horas / course_name).
        _low = svg_text.lower()
        _split_name = (
            "fideimas" in _low
            or "line_curso" in _low
            or "line_horas" in _low
            or "course_name" in _low
        )
        if field_id == "recipient_name" and _split_name:
            linea1, linea2 = _split_name_lines(raw_val)
            if linea2:
                safe_l1 = linea1.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
                safe_l2 = linea2.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
                safe_id = _re.escape(field_id)
                def make_two_line(l1, l2):
                    def _r(m):
                        tag   = m.group(1)
                        inner = m.group(2)
                        xm = _re.search(r'<tspan[^>]+x=["\']([^"\']*)["\']', inner)
                        ym = _re.search(r'<tspan[^>]+y=["\']([^"\']*)["\']', inner)
                        if not xm:
                            xm = _re.search(r'\bx=["\']([^"\']*)["\']', tag)
                        if not ym:
                            ym = _re.search(r'\by=["\']([^"\']*)["\']', tag)
                        x_val = xm.group(1) if xm else "421"
                        y_val = float(ym.group(1)) if ym else 218.0
                        fs_m  = _re.search(r'font-size=["\']([^"\']+)["\']', tag)
                        fs    = float(fs_m.group(1)) if fs_m else 32.0
                        lh    = fs * 1.3
                        y1    = y_val - lh * 0.5
                        new_inner = (
                            f'<tspan x="{x_val}" y="{y1:.1f}">{l1}</tspan>'
                            f'<tspan x="{x_val}" dy="{lh:.1f}">{l2}</tspan>'
                        )
                        return m.group(1) + new_inner + m.group(3)
                    return _r
                result = _re.sub(
                    r'(<text\b[^>]*\bid=["\']' + safe_id + r'["\'][^>]*>)([\s\S]*?)(</text>)',
                    make_two_line(safe_l1, safe_l2),
                    result, flags=_re.IGNORECASE
                )
                continue

        safe_id  = _re.escape(str(field_id))
        safe_val = raw_val.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
        def make_replacer(val):
            def _replacer(m):
                inner = m.group(2)
                if _re.search(r'<tspan\b', inner, _re.IGNORECASE):
                    def _tspan(tm): return tm.group(1) + val + tm.group(2)
                    new_inner = _re.sub(r'(<tspan\b[^>]*>)[^<]*(</tspan>)', _tspan, inner, count=1, flags=_re.IGNORECASE)
                else:
                    new_inner = val
                return m.group(1) + new_inner + m.group(3)
            return _replacer
        result = _re.sub(
            r'(<text\b[^>]*\bid=["\']' + safe_id + r'["\'][^>]*>)([\s\S]*?)(</text>)',
            make_replacer(safe_val), result, flags=_re.IGNORECASE
        )
        result = _re.sub(
            r'(<tspan\b[^>]*\bid=["\']' + safe_id + r'["\'][^>]*>)[^<]*(</tspan>)',
            lambda m, v=safe_val: m.group(1) + v + m.group(2),
            result, flags=_re.IGNORECASE
        )
    return result




def _remove_paths_by_id_keywords(svg_text: str, keywords: list) -> str:
    """
    Elimina <path .../> cuyo id contiene alguna keyword.

    Estrategia: buscar id="...keyword..." con regex (solo sobre el
    atributo id, no sobre el d="" completo), luego localizar el inicio
    del <path con rfind y el cierre /> con find. Funciona incluso cuando
    el atributo d="" tiene '>' sin escapar (exportación de Figma).
    """
    import re as _re
    result = svg_text

    for kw in keywords:
        escaped = _re.escape(kw)
        id_pat  = _re.compile(r'id=["\'][^"\']*' + escaped + r'[^"\']*["\']')
        # Iterar hasta no encontrar más ocurrencias (puede haber varias)
        while True:
            m = id_pat.search(result)
            if not m:
                break
            # Inicio del elemento <path que contiene este id
            path_start = result.rfind('<path', 0, m.start())
            if path_start == -1:
                break
            # Fin del elemento: primer /> después del id
            # Los comandos SVG de <path> nunca contienen '/>',
            # por lo que el primer /> encontrado es siempre el cierre real.
            close = result.find('/>', m.end())
            if close == -1:
                break
            result = result[:path_start] + result[close + 2:]

    return result


def _fix_cursos_svg(svg_text: str) -> str:
    """
    Detecta SVGs de certificado de cursos y reconstruye el cuerpo dinámico.
    Elimina paths vectorizados originales usando parser carácter a carácter
    para manejar correctamente '>' dentro del atributo d="".
    """
    import re as _re

    # Certificado de cursos: DEBE tener line_curso Y line_horas (o al menos uno)
    # No confundir con otros certificados que tengan line_fechas
    has_line_curso = _re.search(r'<text\b[^>]*id=["\']line_curso["\']', svg_text, _re.IGNORECASE) or 'line_curso' in svg_text
    has_line_horas = _re.search(r'<text\b[^>]*id=["\']line_horas["\']', svg_text, _re.IGNORECASE) or 'line_horas' in svg_text

    is_cursos = has_line_curso or has_line_horas
    if not is_cursos:
        return svg_text

    # Si ya tiene todos los <text> necesarios no procesar de nuevo.
    # Un SVG ya procesado volvería a recibir un rect blanco encima de los campos.
    required_ids = ['recipient_name', 'line_curso', 'line_horas', 'line_fechas', 'issue_date']
    all_present = all(
        _re.search(r'<text\b[^>]*id=["\']' + _re.escape(rid) + r'["\']', svg_text, _re.IGNORECASE)
        for rid in required_ids
    )
    if all_present:
        return svg_text

    paths_keywords = [
        'Por haber',
        'course_name_1',
        'con un total',
        'hours_issue',
        'course_name_2',
        'impartidas',
        'desde el',
        'al',
        'date_issue_1',
        'date_issue_2',
        'date_issue',
        'Otorgado en la ciudad',
        'participant_name',
    ]
    result = _remove_paths_by_id_keywords(svg_text, paths_keywords)

    fill = '#666666'
    ff   = 'Sen,Liberation Sans,DejaVu Sans,sans-serif'

    insertions = []
    if 'id="recipient_name"' not in result:
        insertions.append(
            f'<text id="recipient_name" fill="{fill}" font-family="{ff}" '
            f'font-size="32" font-weight="400" text-anchor="middle" '
            f'style="white-space:pre" xml:space="preserve">'
            f'<tspan x="421" y="218">recipient_name</tspan></text>'
        )
    if 'id="line_curso"' not in result:
        insertions.append(
            f'<text id="line_curso" fill="{fill}" font-family="{ff}" font-size="11" '
            f'text-anchor="middle" style="white-space:pre" xml:space="preserve">'
            f'<tspan x="421" y="283">line_curso</tspan></text>'
        )
    if 'id="line_horas"' not in result:
        insertions.append(
            f'<text id="line_horas" fill="{fill}" font-family="{ff}" font-size="11" '
            f'text-anchor="middle" style="white-space:pre" xml:space="preserve">'
            f'<tspan x="421" y="302">line_horas</tspan></text>'
        )
    if 'id="line_fechas"' not in result:
        insertions.append(
            f'<text id="line_fechas" fill="{fill}" font-family="{ff}" font-size="11" '
            f'text-anchor="middle" style="white-space:pre" xml:space="preserve">'
            f'<tspan x="421" y="321">line_fechas</tspan></text>'
        )
    if 'id="issue_date"' not in result:
        insertions.append(
            f'<text id="issue_date" fill="{fill}" font-family="{ff}" '
            f'font-size="11" font-weight="700" text-anchor="middle" '
            f'style="white-space:pre" xml:space="preserve">'
            f'<tspan x="421" y="379">issue_date</tspan></text>'
        )
    if 'Otorgado en la ciudad' not in result:
        insertions.append(
            f'<text fill="{fill}" font-family="{ff}" font-size="11" font-weight="400" '
            f'text-anchor="middle" style="white-space:pre" xml:space="preserve">'
            f'<tspan x="421" y="360">Otorgado en la ciudad de Cartago, el</tspan></text>'
        )

    if insertions:
        # Rectángulo blanco que cubre el área de texto dinámico para
        # tapar cualquier path vectorial estático que no se haya eliminado.
        # Empieza en y=260 (después del nombre del participante ~y=255)
        # hasta y=410 (cubre line_curso y=283, line_horas y=302,
        # line_fechas y=321, Otorgado y=360, issue_date y=379).
        cover = '<rect x="95" y="260" width="640" height="155" fill="white" opacity="1"/>'
        result = result.replace('</svg>', cover + '\n' + '\n'.join(insertions) + '\n</svg>')

    return result


def _fix_outlined_text(svg_text: str) -> str:
    """
    Figma a veces exporta texto como <path> (outline/vectorizado).
    Detecta recipient_name e issue_date como <path> y los convierte
    a <text> editables para que _fill_svg pueda reemplazarlos.
    """
    import re as _re
    fixes = [
        ("recipient_name",
         '<text id="recipient_name" fill="#00457C"'
         ' style="white-space: pre" xml:space="preserve"'
         ' font-family="Onest,Liberation Sans,DejaVu Sans,sans-serif"'
         ' font-size="36" font-weight="800" letter-spacing="0em">'
         '<tspan x="65.4" y="314">recipient_name</tspan></text>'),
        ("issue_date",
         '<text id="issue_date" fill="#00457C"'
         ' style="white-space: pre" xml:space="preserve"'
         ' font-family="Outfit,Liberation Sans,DejaVu Sans,sans-serif"'
         ' font-size="14" letter-spacing="0em">'
         '<tspan x="60" y="462.08">issue_date</tspan></text>'),
    ]
    PAT = r'<path[^>]+id=[\x22\x27]{fid}[\x22\x27][^>]*/>'
    for fid, replacement in fixes:
        pat = PAT.format(fid=_re.escape(fid))
        if _re.search(pat, svg_text):
            svg_text = _re.sub(pat, replacement, svg_text)
    return svg_text


def _fix_image_patterns(svg_text: str) -> str:
    """
    Figma exporta logos via <pattern> + <rect fill="url(#patternX)">.
    El pattern contiene un <use href="#imageId"> que apunta a un <image>
    en <defs> con el base64 real. cairosvg no renderiza esto correctamente.
    Reemplaza cada rect con un <image> directo con el base64 real.
    """
    import re as _re
    from xml.etree import ElementTree as _ET

    try:
        root = _ET.fromstring(svg_text)
    except _ET.ParseError:
        return svg_text

    XLINK = 'http://www.w3.org/1999/xlink'

    # 1. Construir mapa id → href para todos los <image> en el SVG
    image_hrefs = {}
    for el in root.iter():
        tag = el.tag.split('}')[-1] if '}' in el.tag else el.tag
        if tag == 'image':
            eid = el.get('id')
            href = el.get(f'{{{XLINK}}}href') or el.get('href', '')
            if eid and href.startswith('data:'):
                image_hrefs[eid] = href

    if not image_hrefs:
        return svg_text

    # 2. Para cada <pattern>, resolver qué imagen usa
    pattern_images = {}
    for el in root.iter():
        tag = el.tag.split('}')[-1] if '}' in el.tag else el.tag
        if tag != 'pattern':
            continue
        pat_id = el.get('id')
        if not pat_id:
            continue
        # Buscar <use> o <image> hijo con href
        for child in el.iter():
            ctag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
            href = child.get(f'{{{XLINK}}}href') or child.get('href', '')
            if href.startswith('#'):
                ref_id = href[1:]
                if ref_id in image_hrefs:
                    pattern_images[pat_id] = image_hrefs[ref_id]
                    break
            elif href.startswith('data:'):
                pattern_images[pat_id] = href
                break

    if not pattern_images:
        return svg_text

    # 3. Reemplazar cada <rect fill="url(#patternX)"> por <image> directo
    result = svg_text
    for pat_id, img_href in pattern_images.items():
        safe_id = _re.escape(pat_id)
        for rm in _re.finditer(
            r'<rect([^>]+)fill=["\']url\(#' + safe_id + r'\)["\'][^/]*/>',
            result
        ):
            attrs = rm.group(1)
            def attr(name, default, a=attrs):
                m = _re.search(r'\b' + name + r'=["\']([^"\']+)["\']', a)
                return m.group(1) if m else default
            new_tag = (
                f'<image x="{attr("x","0")}" y="{attr("y","0")}"'
                f' width="{attr("width","10")}" height="{attr("height","10")}"'
                f' preserveAspectRatio="xMidYMid meet"'
                f' xmlns:xlink="http://www.w3.org/1999/xlink"'
                f' xlink:href="{img_href}"/>'
            )
            result = result.replace(rm.group(0), new_tag, 1)
    return result




def _inject_firma_yorleny(svg_text: str) -> str:
    """
    Inserta el sello de firma digital de Yorleny León Marchena
    en el SVG del certificado, encima de su línea de firma.
    Solo actúa si el SVG contiene la firma de Yorleny (id con 'Yorleny').
    """
    import re as _re, os as _os
    from xml.etree import ElementTree as _ET

    # Verificar que este SVG tiene la firma de Yorleny
    if 'Yorleny' not in svg_text and 'yorleny' not in svg_text.lower():
        return svg_text

    # Verificar que el sello no está ya insertado
    if 'firma_yorleny' in svg_text or 'Documento firmado' in svg_text:
        return svg_text

    # Cargar el SVG del sello y extraer el base64
    sello_path = _os.path.join(_os.path.dirname(__file__), 'templates', 'firma_yorleny.svg')
    if not _os.path.exists(sello_path):
        return svg_text

    try:
        with open(sello_path, 'r', encoding='utf-8') as f:
            sello_svg = f.read()
        root_sello = _ET.fromstring(sello_svg)
        XLINK = 'http://www.w3.org/1999/xlink'
        sello_b64 = None
        for el in root_sello.iter():
            tag = el.tag.split('}')[-1] if '}' in el.tag else el.tag
            if tag == 'image':
                href = el.get(f'{{{XLINK}}}href') or el.get('href', '')
                if href.startswith('data:'):
                    sello_b64 = href
                    break
        if not sello_b64:
            return svg_text
    except Exception:
        return svg_text

    # Posición del sello: x=328, y=460, w=80, h=38
    sello_tag = (
        f'<image x="328" y="460" width="80" height="38"'
        f' preserveAspectRatio="xMidYMid meet"'
        f' xmlns:xlink="http://www.w3.org/1999/xlink"'
        f' xlink:href="{sello_b64}"/>\n  '
    )

    # Insertar antes del path/text de Yorleny León Marchena
    result = _re.sub(
        r'(<(?:path|text|g)[^>]+id=["\'][^"\']*[Yy]orleny[^"\']*["\'])',
        sello_tag + r'\1',
        svg_text,
        count=1
    )
    return result


def _embed_fonts(svg_text: str) -> str:
    """
    Embebe Onest ExtraBold y Outfit Regular como base64 en el SVG.
    Busca primero en backend/fonts/ (incluido en el repo),
    luego en el sistema como fallback.
    """
    import base64, os

    base_dir = os.path.dirname(os.path.abspath(__file__))

    font_map = {
        "Onest": {
            "weight": "800",
            "paths": [
                os.path.join(base_dir, "fonts", "Onest.ttf"),          # en el repo
                "/usr/local/share/fonts/custom/Onest.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            ],
        },
        "Outfit": {
            "weight": "400",
            "paths": [
                os.path.join(base_dir, "fonts", "Outfit.ttf"),          # en el repo
                "/usr/local/share/fonts/custom/Outfit.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            ],
        },
        "Sen": {
            "weight": "400 700",
            "paths": [
                os.path.join(base_dir, "fonts", "Sen.ttf"),              # en el repo
                "/usr/local/share/fonts/custom/Sen.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            ],
        },
        "MonteCarlo": {
            "weight": "400 700",
            "paths": [
                os.path.join(base_dir, "fonts", "MonteCarlo.ttf"),       # en el repo
                "/usr/local/share/fonts/custom/MonteCarlo.ttf",
            ],
        },
        "Poppins": {
            "weight": "400 700",
            "paths": [
                os.path.join(base_dir, "fonts", "Poppins.ttf"),          # en el repo
                "/usr/local/share/fonts/custom/Poppins.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            ],
        },
    }

    styles = []
    for family, cfg in font_map.items():
        font_path = next((p for p in cfg["paths"] if os.path.exists(p)), None)
        if not font_path:
            continue
        with open(font_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        weight_val = cfg["weight"]
        # Sen es variable — registrar para regular y bold con el mismo archivo
        if " " in str(weight_val):
            for w in str(weight_val).split():
                styles.append(
                    f"@font-face {{\n"
                    f"  font-family: '{family}';\n"
                    f"  font-weight: {w};\n"
                    f"  src: url('data:font/truetype;base64,{b64}') format('truetype');\n"
                    f"}}"
                )
        else:
            styles.append(
                f"@font-face {{\n"
                f"  font-family: '{family}';\n"
                f"  font-weight: {weight_val};\n"
                f"  src: url('data:font/truetype;base64,{b64}') format('truetype');\n"
                f"}}"
            )

    if not styles:
        return svg_text

    font_block = "<defs><style>" + "\n".join(styles) + "</style></defs>"
    import re as _re
    return _re.sub(r"(<svg\b[^>]*>)", lambda m: m.group(1) + font_block, svg_text, count=1)



def _load_template(template_name: str):
    safe = Path(template_name).name
    path = TEMPLATES_DIR / safe
    return path.read_text(encoding="utf-8") if path.exists() else None


def _detect_elements(svg_text: str) -> list:
    """Return list of {id, tag, text, x, y, font_size} for <text>/<tspan> elements with id."""
    try:
        root = ET.fromstring(svg_text)
    except ET.ParseError:
        return []
    NS = "http://www.w3.org/2000/svg"
    results = []
    for el in root.iter():
        tag = el.tag.split("}")[-1] if "}" in el.tag else el.tag
        if tag not in ("text", "tspan"):
            continue
        eid = el.get("id")
        if not eid:
            continue
        results.append({
            "id":        eid,
            "tag":       tag,
            "text":      (el.text or "").strip()[:60],
            "x":         el.get("x", ""),
            "y":         el.get("y", ""),
            "font_size": el.get("font-size", el.get("fontSize", "")),
        })
    return results


def _svg_to_output(svg_text: str, fmt: str) -> bytes:
    if not CAIRO_OK:
        raise RuntimeError("cairosvg no instalado en el servidor")
    svg_text = _embed_fonts(svg_text)
    enc = svg_text.encode("utf-8")
    scale = 3  # 3× = 216 DPI — calidad de impresión
    png_bytes = cairosvg.svg2png(bytestring=enc, scale=scale)
    if fmt != "pdf":
        return png_bytes
    # PDF = PNG renderizado y envuelto con Pillow.
    # resolution = scale * 72 mantiene el tamaño físico correcto (A4).
    from PIL import Image
    import io as _io
    img = Image.open(_io.BytesIO(png_bytes))
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")
    pdf_buf = _io.BytesIO()
    img.save(pdf_buf, format="PDF", resolution=scale * 72)
    return pdf_buf.getvalue()


# Cache para consultas de cédulas al TSE
_cedula_cache: dict = {}

def _lookup_cedula(cedula: str) -> str | None:
    """
    Consulta el nombre completo por cédula.
    Intenta múltiples APIs del estado costarricense.
    """
    import urllib.request as _ur
    import json as _json
    import urllib.error as _ue

    cedula = cedula.strip().replace("-", "").replace(" ", "").replace(".", "")
    if not cedula.isdigit() or len(cedula) < 8:
        return None

    if cedula in _cedula_cache:
        return _cedula_cache[cedula]

    apis = [
        f"https://api.hacienda.go.cr/fe/ae?identificacion={cedula}",
        f"https://api.suitetecnologica.com/api/v1/personas/{cedula}",
    ]

    for url in apis:
        try:
            req = _ur.Request(url, headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json",
            })
            with _ur.urlopen(req, timeout=8) as resp:
                raw = resp.read().decode("utf-8")
                data = _json.loads(raw)

            # Formato Hacienda: {"nombre": "JUAN PEREZ"}
            nombre = (
                data.get("nombre") or
                data.get("name") or
                data.get("fullName") or
                ""
            ).strip().upper()

            if nombre and len(nombre) > 3:
                _cedula_cache[cedula] = nombre
                return nombre
        except (_ue.URLError, _ue.HTTPError, Exception):
            continue

    _cedula_cache[cedula] = None
    return None


# Sinónimos conocidos por campo destino. La clave es el id del campo SVG,
# el valor es la lista de alias (en minúsculas, sin acentos) que se aceptan.
_FIELD_SYNONYMS = {
    "__name__":      ["nombre", "name", "participante", "estudiante", "alumno",
                       "full name", "fullname", "nombre completo", "recipient",
                       "recipient name", "recipient_name", "nombre del participante"],
    "__date__":      ["fecha", "date", "issue date", "issue_date", "fecha otorgacion",
                       "fecha de otorgacion", "fecha emision", "fecha de emision"],
    "course_name_1": ["tipo curso", "tipo_curso", "tipo", "course name 1", "course_name_1"],
    "course_name_2": ["nombre curso", "nombre_curso", "curso", "course name 2", "course_name_2"],
    "hours_issue":   ["horas", "hours", "hours_issue", "total horas", "total_horas",
                       "duracion", "duración", "horas totales"],
    "date_issue_1":  ["fecha inicio", "fecha_inicio", "inicio", "date_issue_1", "start"],
    "date_issue_2":  ["fecha fin", "fecha_fin", "fin", "date_issue_2", "end"],
}


def _normalize_header(h: str) -> str:
    """Minúsculas, sin acentos, sin espacios extra para comparar cabeceras."""
    import unicodedata
    h = h.strip().lower()
    h = "".join(c for c in unicodedata.normalize("NFD", h)
                if unicodedata.category(c) != "Mn")
    return h


def _best_column_match(headers: list, aliases: list, threshold: float = 0.78):
    """
    Devuelve la cabecera del CSV que mejor coincide con la lista de alias.
    Primero busca coincidencia exacta normalizada; si no, usa similitud
    aproximada (fuzzy) con difflib. Devuelve None si nada supera el umbral.
    """
    from difflib import SequenceMatcher
    norm_aliases = [_normalize_header(a) for a in aliases]

    # 1. Coincidencia exacta normalizada
    for h in headers:
        if _normalize_header(h) in norm_aliases:
            return h

    # 2. Coincidencia aproximada
    best, best_score = None, 0.0
    for h in headers:
        nh = _normalize_header(h)
        for na in norm_aliases:
            score = SequenceMatcher(None, nh, na).ratio()
            # Bonus si una contiene a la otra (ej. "nombre del alumno" vs "nombre")
            if na in nh or nh in na:
                score = max(score, 0.9)
            if score > best_score:
                best, best_score = h, score
    return best if best_score >= threshold else None


def _resolve_fields(row: dict, name_id: str, date_id: str) -> dict:
    """Mapea una fila CSV a los ids de campo del SVG usando fuzzy matching
    sobre las cabeceras (tolera variantes como 'Full Name', 'Estudiante')."""
    raw     = {k.strip(): v.strip() for k, v in row.items()}
    fields  = dict(raw)  # pasa todas las columnas tal cual
    headers = list(raw.keys())

    # Mapa de campo destino → id real en el SVG
    targets = {
        "__name__":      name_id,
        "__date__":      date_id,
        "course_name_1": "course_name_1",
        "course_name_2": "course_name_2",
        "hours_issue":   "hours_issue",
        "date_issue_1":  "date_issue_1",
        "date_issue_2":  "date_issue_2",
    }

    for key, target_id in targets.items():
        col = _best_column_match(headers, _FIELD_SYNONYMS[key])
        if col and raw.get(col):
            fields[target_id] = raw[col]

    return fields


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


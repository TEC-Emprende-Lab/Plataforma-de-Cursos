"""Transformaciones SVG para la generación de certificados.

Agrupa todos los helpers determinísticos de SVG: detección de elementos,
llenado de campos, corrección de plantillas vectorizadas de Figma, embedding
de fuentes y conversión a PNG/PDF con cairosvg. Importa la corrección de
tildes desde ai_service sin generar ciclos.
"""

from __future__ import annotations

import re
from pathlib import Path
from xml.etree import ElementTree as ET

from services.ai import _fix_tildes


# Directorio raíz del backend (backend/), a partir de services/svg.py
BACKEND_DIR = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = BACKEND_DIR / "templates"

try:
    import cairosvg
    CAIRO_OK = True
except ImportError:
    CAIRO_OK = False


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
    sello_path = _os.path.join(str(BACKEND_DIR), 'templates', 'firma_yorleny.svg')
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

    base_dir = str(BACKEND_DIR)

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

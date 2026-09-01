"""Resolución de columnas CSV para la generación de certificados.

Contiene el mapeo por sinónimos (fuzzy) entre las cabeceras de un CSV y los
campos destino del SVG. Es determinístico y no depende de otros servicios.
"""

from __future__ import annotations

from difflib import SequenceMatcher
import unicodedata


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

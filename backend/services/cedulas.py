"""Consulta de nombres por cédula en servicios externos del estado costarricense."""

from __future__ import annotations


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


def lookup_many(cedulas, max_cedulas: int) -> list[dict]:
    """Resuelve una lista de cédulas a nombres oficiales."""
    from services.errors import ServiceError

    if not cedulas or not isinstance(cedulas, list):
        raise ServiceError("Enviá un JSON con campo 'cedulas' como lista")
    if len(cedulas) > max_cedulas:
        raise ServiceError(
            f"La consulta admite como máximo {max_cedulas} cédulas.",
            code="too_many_cedulas",
        )

    results = []
    for ced in cedulas:
        nombre = _lookup_cedula(str(ced))
        results.append({
            "cedula": str(ced),
            "nombre": nombre,
            "ok": nombre is not None,
        })
    return results

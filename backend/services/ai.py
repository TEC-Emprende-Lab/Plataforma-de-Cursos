"""Servicios de IA y corrección lingüística para certificados.

Contiene el cliente de IA (Anthropic preferido, OpenAI como fallback) y la
corrección de tildes en nombres propios, que usa el diccionario local y la IA
como refuerzo opcional.
"""

from __future__ import annotations

import os

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


def map_svg_fields(elements, request_id: str) -> dict:
    """Sugiere name_id y date_id a partir de elementos SVG detectados."""
    import json
    import logging
    import re

    from services.errors import ServiceError

    logger = logging.getLogger("certificate_api")

    if not AI_OK or not AI_CLIENT:
        raise ServiceError(
            "IA no disponible — configurá ANTHROPIC_API_KEY",
            status=503,
        )
    if not elements:
        raise ServiceError("No se encontraron elementos con id en el SVG")

    ids = [e["id"] for e in elements]
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
        if hasattr(AI_CLIENT, "messages"):
            msg = AI_CLIENT.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
            )
            text = msg.content[0].text.strip()
        else:
            resp = AI_CLIENT.chat.completions.create(
                model="gpt-4o-mini", max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.choices[0].message.content.strip()

        m = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
        if m:
            text = m.group(1)
        result = json.loads(text)
        if result.get("name_id") not in ids:
            result["name_id"] = ids[0] if ids else ""
        if result.get("date_id") not in ids:
            result["date_id"] = ids[1] if len(ids) > 1 else ids[0] if ids else ""
        return result
    except (json.JSONDecodeError, ValueError):
        logger.exception("Respuesta IA inválida request_id=%s", request_id)
        raise ServiceError(
            "La IA devolvió una respuesta inválida.",
            status=502,
            code="ai_invalid_response",
        ) from None
    except ServiceError:
        raise
    except Exception:
        logger.exception("Fallo del proveedor IA request_id=%s", request_id)
        raise ServiceError(
            "No se pudo consultar la IA.",
            status=502,
            code="ai_failed",
        ) from None

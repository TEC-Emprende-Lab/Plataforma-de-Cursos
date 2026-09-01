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

"""Instalación de fuentes en el arranque del proceso, no en la importación.

Gunicorn importa `app.py` y este módulo se invoca después de `create_app()`.
En `APP_ENV=test` no se comprueba ni se copia nada: las pruebas no deben
tocar fontconfig ni el directorio de fuentes del sistema.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess

_LOGGER = logging.getLogger(__name__)
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))


def _install_fonts() -> None:
    """Comprueba las fuentes sin descargar ni modificar recursos remotos."""
    try:
        result = subprocess.run(["fc-list"], capture_output=True, text=True)
        fonts_list = result.stdout.lower()
        missing = [name for name in ("outfit", "onest") if name not in fonts_list]
        if missing:
            _LOGGER.warning("Fuentes esperadas no disponibles: %s", ", ".join(missing))
    except Exception as e:
        _LOGGER.warning("No se pudo comprobar fontconfig: %s", e)


def _install_repo_fonts() -> None:
    """Copia las fuentes del repo al directorio del sistema y refresca fontconfig.

    cairosvg resuelve font-family vía fontconfig, así que las fuentes deben
    estar instaladas en el sistema (no basta con el embebido base64).
    """
    try:
        src_dir = os.path.join(_BACKEND_DIR, "fonts")
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
        subprocess.run(["fc-cache", "-f", font_dir], capture_output=True)
    except Exception as e:
        print(f"[fonts] Error copiando fuentes del repo: {e}")


def ensure_runtime_fonts(*, app_env: str) -> None:
    """Instala fuentes al arrancar el proceso, salvo en el entorno de pruebas."""
    if app_env == "test":
        return
    _install_fonts()
    _install_repo_fonts()

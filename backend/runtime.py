"""Estado de proceso asignado al arrancar `app.py`.

Las rutas leen estos atributos en cada request para que los tests puedan
sustituir el almacén, las cuotas y el verificador sin un facade en `app.py`.
"""

from __future__ import annotations

template_store = None
max_batch_rows = 0
max_csv_bytes = 0
max_cedulas = 0
rate_limit_analyze = ""
rate_limit_preview = ""
rate_limit_generate = ""
rate_limit_batch = ""
rate_limit_ai = ""
rate_limit_cedulas = ""
rate_limit_templates = ""

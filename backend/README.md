# Backend — Generador de Certificados

Flask API para generar certificados PDF/PNG a partir de plantillas SVG.

## Instalación

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

> **Nota:** `cairosvg` requiere las librerías del sistema Cairo.
> - **Ubuntu/Debian:** `sudo apt install libcairo2-dev`
> - **macOS:** `brew install cairo`
> - **Windows:** Instalar [GTK3](https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases)

## Uso

```bash
python app.py
# → Escucha en http://localhost:5050
```

Para usar el mapeo con IA, configura tu API key:
```bash
export OPENAI_API_KEY=sk-...
python app.py
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servidor |
| GET | `/api/ai/status` | Disponibilidad de IA |
| GET | `/api/templates/<file>` | Servir SVG crudo |
| POST | `/api/preview` | Devuelve el SVG sin modificar |
| POST | `/api/analyze` | Detecta elementos con `id` |
| POST | `/api/generate` | Genera PDF o PNG individual |
| POST | `/api/generate/batch` | Genera ZIP con múltiples certificados |
| POST | `/api/ai/mapeo` | Mapeo inteligente CSV → SVG |

## Plantillas incluidas

- `templates/template_classic.svg` — Diseño institucional dorado
- `templates/template_modern.svg` — Diseño contemporáneo oscuro

Los campos editables usan `id` en el SVG:
- `recipient_name` — Nombre del participante
- `issue_date` — Fecha de emisión

## Pruebas locales

Desde `backend/`, crear un entorno virtual aislado e instalar las dependencias
de desarrollo:

```powershell
python -m venv ../.venv
../.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
../.venv/Scripts/python.exe -m pytest
```

La suite bloquea las descargas durante la importación, desactiva las claves de
IA y sustituye las consultas de cédulas. Por lo tanto, no requiere red ni accede
a servicios de producción.

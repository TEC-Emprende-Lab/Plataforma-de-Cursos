<div align="center">

# 🎓 TEC Emprende Lab · Plataforma de Cursos

**Sistema de gestión de participantes, accesos y reportes para los cursos virtuales del TEC Emprende Lab.**

[![Producción](https://img.shields.io/badge/producción-online-brightgreen)](https://plataforma-de-cursos-zeta.vercel.app)
[![Stack](https://img.shields.io/badge/stack-React%2018%20%2B%20Vite%205-orange)](#stack-técnico)
[![Backend](https://img.shields.io/badge/backend-Supabase-3ECF8E)](https://supabase.com)
[![Hosting](https://img.shields.io/badge/hosting-Vercel-000000)](https://vercel.com)
[![License](https://img.shields.io/badge/license-Privado-lightgrey)](#contacto)

[🌐 App en producción](https://plataforma-de-cursos-zeta.vercel.app) · [📚 Repo](https://github.com/tecemprendelab/Plataforma-de-Cursos) · [⚙️ Dashboard Vercel](https://vercel.com/tecemprendelab-2825s-projects/plataforma-de-cursos)

</div>

---

## ¿Qué hace esta plataforma?

El TEC Emprende Lab da cursos y talleres virtuales asincrónicos con un esquema de **45 días de acceso por participante**. Esta plataforma resuelve la gestión operativa de esos cursos:

- 📋 **Inscripción**: registrar cada participante con datos de contacto, cédula y cursos en los que está.
- ⏱️ **Control de acceso**: 45 días por defecto desde el ingreso (configurable por curso), con revocación automática al expirar.
- 🏷️ **Clasificación**: etiquetas libres y colores personalizables (Becado, Empresa, Equipo líder, etc.).
- 📨 **Recordatorios**: correo prellenado para avisar de la prueba final cuando faltan ≤7 días.
- 📥 **Importación masiva**: subir un CSV de matrícula y detectar automáticamente quién es nuevo, quién ya está y quién tiene errores.
- 📤 **Exportación**: Excel, CSV y reporte PDF ejecutivo con stats, cursos y lista detallada.

## Funcionalidades

### Participantes

- [x] CRUD completo con cédula, nombre, correo, teléfono, estado, pago, acceso, fecha de ingreso, notas.
- [x] Relaciones N:N con cursos y etiquetas.
- [x] Barra de progreso de 45 días con colores semánticos.
- [x] Revocación automática al expirar.
- [x] Vista de perfil individual con edición de etiquetas in-line.

### Cursos y talleres

- [x] CRUD completo.
- [x] Conteo de inscritos por curso y porcentaje de ocupación.
- [x] Toggle activo / inactivo.
- [x] Borrado con cascade que limpia inscripciones.

### Etiquetas

- [x] CRUD libre con paletas de color predefinidas.
- [x] Conteo de uso por etiqueta.
- [x] Borrado con cascade.

### Importación / exportación

- [x] **Importar CSV** de matrícula.
- [x] Match contra DB por email y cédula.
- [x] Preview antes de confirmar.
- [x] **Exportar a Excel** (`.xlsx`).
- [x] **Exportar a CSV**.
- [x] **Reporte PDF** ejecutivo configurable.

### Autenticación y seguridad

- [x] Login con Supabase Auth.
- [x] Row Level Security activo en todas las tablas.
- [x] Solo usuarios autenticados pueden leer/escribir.
- [x] Cliente Supabase con retry automático para `PGRST303`.
- [x] Separación entre persistencia local y Supabase mediante adapters.
- [x] Producción no activa `localStorage` accidentalmente cuando Supabase no está configurado.

## Stack técnico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React | 18.3 |
| Build | Vite | 5.4 |
| Estilos | CSS variables + Poppins | — |
| Iconos | Tabler Icons | — |
| Backend | Supabase Postgres | 17.6 |
| Auth | Supabase Auth | — |
| Hosting | Vercel | Fluid Compute |
| PDF | jsPDF + jspdf-autotable | 4.x / 5.x |
| Excel | ExcelJS | 4.4 |
| Testing frontend | Vitest | — |
| Testing backend | pytest | — |
| Static analysis | ESLint / Semgrep | — |

**No usamos:** TypeScript en runtime, frameworks de UI tipo Material/Chakra/Tailwind ni librerías de state global. El proyecto se mantiene deliberadamente liviano.

**Arquitectura en una línea:** Componentes → Hooks → Adapters (`local` / `supabase`) → Persistencia. Detalles completos en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Quick start (desarrollo local)

```bash
# 1. Clonar
git clone https://github.com/tecemprendelab/Plataforma-de-Cursos.git
cd Plataforma-de-Cursos

# 2. Instalar dependencias
npm install

# 3. Configurar variables
cp .env.example .env.local

# 4. Ejecutar
npm run dev
```

Por defecto, para trabajar contra la base de datos real:

```env
VITE_STORAGE_MODE=supabase
```

Para desarrollar sin modificar Supabase:

```env
VITE_STORAGE_MODE=local
```

## Variables de entorno

| Variable | Para qué | Obligatoria |
|---|---|---|
| `VITE_STORAGE_MODE` | Selecciona `supabase` o `local` | Sí |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | Sí en modo Supabase |
| `VITE_SUPABASE_ANON_KEY` | Publishable key | Sí en modo Supabase |

Ejemplo:

```env
VITE_STORAGE_MODE=supabase
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Documentación detallada

| Documento | Contenido |
|---|---|
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Capas, patrón Adapter, contratos Hooks↔Adapters, reglas de errores, modo de almacenamiento, convenciones y decisiones de alcance. |
| [`docs/BASE-DE-DATOS.md`](docs/BASE-DE-DATOS.md) | Esquema SQL, RLS, migraciones versionadas, seed y tipos TypeScript. |
| [`docs/OPERACION.md`](docs/OPERACION.md) | Importar CSV, reportes PDF, deploy en Vercel y troubleshooting. |
| [`CODEBASE_CONTEXT.md`](CODEBASE_CONTEXT.md) | Mapa técnico vivo del código fuente (referencia para desarrollo). |
| [`ROADMAP.md`](ROADMAP.md) | Plan de trabajo, decisiones y registro de validaciones. |

## Contacto

**TEC Emprende Lab — Instituto Tecnológico de Costa Rica**

📧 tecemprendelab@itcr.ac.cr  
📞 2550-9270

<sub>Hecho con ☕ en Costa Rica.</sub>

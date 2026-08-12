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

## Tabla de contenidos

- [¿Qué hace esta plataforma?](#qué-hace-esta-plataforma)
- [Funcionalidades](#funcionalidades)
- [Stack técnico](#stack-técnico)
- [Arquitectura](#arquitectura)
- [Esquema de base de datos](#esquema-de-base-de-datos)
- [Quick start (desarrollo local)](#quick-start-desarrollo-local)
- [Variables de entorno](#variables-de-entorno)
- [Workflows](#workflows)
  - [Importar participantes desde CSV](#-importar-participantes-desde-csv)
  - [Generar reporte PDF](#-generar-reporte-pdf)
  - [Aplicar una nueva migración Supabase](#-aplicar-una-nueva-migración-supabase)
  - [Regenerar tipos TypeScript](#-regenerar-tipos-typescript)
- [Deploy](#deploy)
- [Convenciones de código](#convenciones-de-código)
- [Troubleshooting](#troubleshooting)
- [Decisiones de alcance](#decisiones-de-alcance)
- [Contacto](#contacto)

---

## ¿Qué hace esta plataforma?

El TEC Emprende Lab da cursos y talleres virtuales asincrónicos con un esquema de **45 días de acceso por participante**. Esta plataforma resuelve la gestión operativa de esos cursos:

- 📋 **Inscripción**: registrar cada participante con datos de contacto, cédula y cursos en los que está.
- ⏱️ **Control de acceso**: 45 días por defecto desde el ingreso, con revocación automática al expirar.
- 🏷️ **Clasificación**: etiquetas libres y colores personalizables (Becado, Empresa, Equipo líder, etc.).
- 📨 **Recordatorios**: correo prellenado para avisar de la prueba final cuando faltan ≤7 días.
- 📥 **Importación masiva**: subir un CSV de matrícula y detectar automáticamente quién es nuevo, quién ya está y quién tiene errores.
- 📤 **Exportación**: Excel, CSV y reporte PDF ejecutivo con stats, cursos y lista detallada.

---

## Funcionalidades

### Participantes
- [x] CRUD completo con cédula, nombre, correo, teléfono, estado, pago, acceso, fecha de ingreso, notas
- [x] Relaciones N:N con cursos y etiquetas
- [x] Barra de progreso de 45 días con colores semánticos (verde / naranja / rojo)
- [x] Revocación automática al expirar (lógica en `src/utils/time.js`)
- [x] Vista de perfil individual con edición de etiquetas in-line

### Cursos y talleres
- [x] CRUD completo (nombre, código, modalidad, plataforma, fechas, capacidad, precio en colones)
- [x] Conteo de inscritos por curso y % de ocupación
- [x] Toggle activo / inactivo
- [x] Borrado con cascade que limpia inscripciones (FK)

### Etiquetas
- [x] CRUD libre con 10 paletas de color predefinidas
- [x] Conteo de uso por etiqueta + % del total
- [x] Borrado con cascade

### Importación / exportación
- [x] **Importar CSV** de matrícula con parser robusto (tolera filas malformadas)
- [x] Match contra DB por email y cédula (fallback)
- [x] Preview con checkboxes antes de confirmar
- [x] **Exportar a Excel** (`.xlsx`) con todos los campos calculados
- [x] **Exportar a CSV** universal
- [x] **Reporte PDF** ejecutivo con secciones configurables (resumen, cursos, etiquetas, lista)

### Autenticación y seguridad
- [x] Login con Supabase Auth (email + password)
- [x] Row Level Security activo en todas las tablas
- [x] Solo usuarios autenticados pueden leer/escribir
- [x] Cliente Supabase con retry automático en `PGRST303` (clock skew)

### Filtros y navegación
- [x] Buscador full-text por nombre, correo, teléfono
- [x] Filtros por curso, estado de acceso, etiqueta
- [x] Ordenamiento por fecha, nombre, días restantes
- [x] Dashboard con stats live (total, activos, con acceso, por vencer, expirados)

---

## Stack técnico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React | 18.3 |
| Build | Vite | 5.4 |
| Estilos | CSS variables + Poppins | — |
| Iconos | Tabler Icons (via CDN) | — |
| Backend | Supabase Postgres | 17.6 |
| Auth | Supabase Auth | — |
| Hosting | Vercel | Fluid Compute |
| PDF | jsPDF + jspdf-autotable | 4.x / 5.x |
| Excel | ExcelJS | 4.4 |
| MCP servers | Supabase MCP `scope=project` | — |

**No usamos:** TypeScript en runtime, frameworks de UI tipo Material/Chakra/Tailwind, librerías de state global. Mantenido deliberadamente liviano.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                       Cliente (Vercel)                      │
│                                                             │
│   ┌─────────┐    ┌──────────────────────────────────────┐   │
│   │ App.jsx │ ── │           AuthenticatedApp           │   │
│   └─────────┘    │  ┌──────────┐  ┌─────────────────┐   │   │
│       │          │  │ Sidebar  │  │ Vista activa    │   │   │
│       │          │  └──────────┘  │ (Dashboard,     │   │   │
│       │ useAuth  │                │  Participants,  │   │   │
│       ▼          │                │  Courses, ...)  │   │   │
│   ┌──────────────┴────────────────└─────────────────┘   │   │
│   │              hooks (estado + mutaciones)            │   │
│   │  useParticipants · useCourses · useTags · useAuth   │   │
│   └─────────────────────────────────────────────────────┘   │
│                              │                              │
│                              │ supabase-js                  │
│                              ▼                              │
└─────────────────────────────────────────────────────────────┘
                               │ HTTPS + JWT
                               ▼
                      ┌──────────────────┐
                      │  Supabase (US)   │
                      │  ┌────────────┐  │
                      │  │ PostgREST  │  │
                      │  │   + RLS    │  │
                      │  └─────┬──────┘  │
                      │        │         │
                      │  ┌─────▼──────┐  │
                      │  │ Postgres   │  │
                      │  │ 5 tablas   │  │
                      │  └────────────┘  │
                      └──────────────────┘
```

### Capas

1. **Componentes** (`src/components/`) — solo UI, reciben datos y callbacks por props. Sin acceso directo a la DB.
2. **Hooks** (`src/hooks/`) — `useParticipants`, `useCourses`, `useTags`, `useAuth`. Gestionan estado local + mutaciones contra Supabase. Exponen la misma API tanto en modo Supabase como en fallback `localStorage`.
3. **Cliente Supabase** (`src/lib/supabase.js`) — singleton con `fetch` envuelto para retry de `PGRST303`.
4. **Utils** (`src/utils/`) — funciones puras: `time.js` (fechas / acceso), `export.js` (Excel/CSV), `pdf.js` (reporte PDF), `email.js` (recordatorios).

### Modo legacy (sin Supabase)

Si las variables `VITE_SUPABASE_*` no están definidas, la app corre con persistencia en `localStorage` y sin guard de sesión. Útil para demos rápidas o para iterar UI sin tocar la DB.

---

## Esquema de base de datos

```sql
courses (
  id          uuid pk,
  name, short, type CHECK,
  platform, start_date, end_date,
  capacity, price, modalidad CHECK, code unique,
  description, active, timestamps
)

tags (
  id          uuid pk,
  name unique, color, created_at
)

participants (
  id          uuid pk,
  cedula      text unique,
  name, email unique, phone,
  status CHECK ('activo','inactivo'),
  payment CHECK ('pagado','pendiente'),
  access boolean, fecha date, notes,
  timestamps
)

participant_courses (             ← N:N
  participant_id, course_id, enrolled_at,
  pk (participant_id, course_id)
)

participant_tags (                ← N:N
  participant_id, tag_id,
  pk (participant_id, tag_id)
)
```

- **RLS activo en todas las tablas**. Política única: `to authenticated using (true)` — admin único confía en sus propias acciones.
- **FK `on delete cascade`** entre las join tables y las principales: borrar un participante limpia automáticamente sus cursos y etiquetas.
- **`updated_at` trigger** (`set_updated_at()` con `search_path = ''`) mantiene la columna sincronizada.

Las 4 migraciones aplicadas viven versionadas en `supabase/migrations/`:

```
20260520161327_init_schema_courses_tags_participants.sql
20260520161611_harden_set_updated_at_search_path.sql
20260520161638_revoke_rls_auto_enable_public_execute.sql
20260520171105_add_cedula_to_participants.sql
```

El seed inicial (4 cursos, 6 tags, 8 participantes demo) está en `supabase/seed.sql`. **No re-ejecutar en prod** — rompería por UNIQUE.

---

## Quick start (desarrollo local)

```bash
# 1. Clonar
git clone https://github.com/tecemprendelab/Plataforma-de-Cursos.git
cd Plataforma-de-Cursos

# 2. Instalar deps
npm install

# 3. Variables de entorno (las keys de Supabase ya vienen llenas en .env.example)
cp .env.example .env.local

# 4. Dev server
npm run dev
# → http://localhost:5173
```

**Login local**: tiene que existir un usuario en Supabase Auth. Pedile al admin que te cree uno en el [dashboard](https://supabase.com/dashboard/project/qhmynvpgmrupqzojcvua/auth/users).

> **Tip:** si no querés pegar la app a la DB real mientras desarrollás, dejá `.env.local` sin las `VITE_SUPABASE_*`. Arranca en modo legacy con `localStorage`.

---

## Variables de entorno

| Variable | Dónde | Para qué | Obligatoria |
|---|---|---|---|
| `VITE_SUPABASE_URL` | cliente | URL del proyecto Supabase | Sí (para auth) |
| `VITE_SUPABASE_ANON_KEY` | cliente | Publishable key (no la `service_role`) | Sí (para auth) |

Las gestionamos en Vercel para los 3 entornos (Production / Preview / Development). Para sincronizarlas:

```bash
npx vercel@latest env pull .env.local   # bajar a local
npx vercel@latest env ls                # listar
```

---

## Workflows

### 📥 Importar participantes desde CSV

1. Generá el CSV con la herramienta del TEC (o cualquier hoja de cálculo). Columnas esperadas:
   ```
   Cédula, Nombre y apellidos, Facturar a nombre de, Teléfono, Correo
   ```
2. En la app → menú **Importar CSV**.
3. Arrastrá el archivo o seleccionálo.
4. La app muestra:
   - Cuántas filas total
   - Cuántos son **nuevos** (no están en DB)
   - Cuántos **ya existen** (match por email o cédula)
   - Si hubo filas con error de formato
5. Marcá los checkboxes de los nuevos que querés importar.
6. **Confirmar e importar**.

El parser es **tolerante a errores**: si una fila tiene una columna duplicada (caso real del CSV del TEC), detecta el tipo de cada token (email regex, cédula = solo dígitos, teléfono = 8 dígitos) en vez de confiar en la posición.

Es **idempotente**: subir el mismo CSV dos veces no duplica filas.

### 📤 Generar reporte PDF

1. En la app → menú **Exportar datos**.
2. Card **Reporte PDF** a la derecha.
3. Tildá las secciones que querés incluir (todas marcadas por default):
   - Resumen general (6 stat cards)
   - Desglose por curso (tabla con % ocupación)
   - Desglose por etiqueta (tabla con % del total)
   - Lista completa de participantes (tabla detallada paginada)
4. **Generar PDF** → se descarga `reporte-tec-emprende-lab-YYYY-MM-DD.pdf`.

Diseño con identidad TEC Emprende Lab: header naranja, tablas con header negro, alternancia de filas crema/blanco.

### 🗄️ Aplicar una nueva migración Supabase

Trabajamos con migraciones versionadas en `supabase/migrations/`. Para agregar una nueva:

```bash
# 1. Crear archivo con timestamp
touch supabase/migrations/$(date -u +%Y%m%d%H%M%S)_descripcion.sql

# 2. Escribir el SQL adentro

# 3. Aplicarla remota (vía MCP de Supabase en Claude Code, o vía CLI)
supabase db push   # si tenés el CLI de Supabase instalado
```

Si solo querés probar el SQL antes de versionarlo: dashboard de Supabase → SQL editor → ejecutar.

> **Importante**: después de cualquier cambio de schema, regenerar los tipos TypeScript (siguiente sección).

### 🧬 Regenerar tipos TypeScript

```bash
# Vía Supabase CLI (si está instalado)
supabase gen types typescript --project-id qhmynvpgmrupqzojcvua > src/lib/database.types.ts

# O vía MCP de Supabase desde Claude Code: usar generate_typescript_types
```

Los tipos son referencia: el proyecto sigue en JS. Si querés tiparlos desde JSDoc:

```js
/** @type {import('../lib/database.types').Tables<'participants'>} */
const row = await supabase.from('participants').select('*').single()
```

---

## Deploy

### Auto-deploy

Cada push a `main` dispara un deploy en Vercel. Verlo en tiempo real:
```bash
npx vercel@latest list
```

### Deploy manual a producción

```bash
npx vercel@latest deploy --prod --yes
```

### Variables sensibles en Vercel

Si necesitás agregar o rotar envs:

```bash
npx vercel@latest env ls                              # listar
npx vercel@latest env add MI_VAR production           # agregar
npx vercel@latest env rm MI_VAR production --yes      # quitar
```

> **Bug conocido del CLI**: `vercel env add VAR preview --value X --yes` falla en CLI v54.x. Workaround: usar la API REST directamente o el dashboard.

---

## Convenciones de código

- **Idioma**: UI / commits / comentarios en **español**. Identificadores en código en **inglés**.
- **Componentes**: PascalCase, hooks `useXxx`, utilidades camelCase.
- **Imports**: alias `@/` apunta a `src/` (configurado en `vite.config.js`).
- **Estilos**: CSS variables en `src/styles/global.css`. Nada de styled-components ni Tailwind.
- **Persistencia**: Supabase si está configurado; fallback `localStorage` si no.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- **PRs**: features → branch + PR; fixes triviales → push directo.

Reglas detalladas para humanos y para Claude en [CLAUDE.md](./CLAUDE.md).

---

## Troubleshooting

### "Cargando…" infinito tras login
Probablemente las envs `VITE_SUPABASE_*` no llegaron al build. Verificá:
```bash
npx vercel@latest env ls
```

### Error en consola: `JWT issued at future` (PGRST303)
Es desfase de reloj entre Supabase Auth y PostgREST. El cliente reintenta automáticamente (3 veces, 400ms / 800ms). Si igual molesta, recargar la página.

### `npm run build` falla con error de módulos
Borrá `node_modules` y `package-lock.json`, reinstalá:
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Importar CSV" salta filas
Mirá la sección **"Filas con error"** del panel de preview. Probablemente la fila no tiene email ni cédula reconocibles. Editá el CSV y reintentá.

### El PDF sale con caracteres raros
jsPDF usa Helvetica con codificación WinAnsi. No soporta `→`, `≤`, emojis. Si agregás texto custom al reporte, usá solo caracteres latín-1.

### Permisos denegados al hacer CRUD
Verificá que estés logueado. Sin sesión válida, todas las queries fallan con 401. La sidebar muestra tu email abajo cuando hay sesión.

---

## Decisiones de alcance

Cosas que **NO** está en alcance del proyecto (decisiones explícitas del cliente):

- ❌ Custom domain — la app vive en `plataforma-de-cursos-zeta.vercel.app`.
- ❌ Backups automáticos — Supabase plan free + DDL versionado en repo.
- ❌ Multi-admin / roles diferenciados — un único admin maneja la plataforma.
- ❌ Sentry / monitoreo externo — los logs de Vercel + console del browser alcanzan.
- ❌ Integración con OpenAI — se reemplazó por importación CSV.

Si en el futuro alguna de estas cambia, hay que revisar las decisiones de seguridad correspondientes (especialmente las RLS policies y los 15 advisors "always-true").

---

## Contacto

**TEC Emprende Lab — Instituto Tecnológico de Costa Rica**
📧 tecemprendelab@itcr.ac.cr · 📞 2550-9270

<sub>Hecho con ☕ en Costa Rica.</sub>

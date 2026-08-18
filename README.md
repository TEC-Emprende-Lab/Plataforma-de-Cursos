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
  - [Capas](#capas)
  - [Patrón Adapter](#patrón-adapter)
  - [Contratos entre Hooks y Adapters](#contratos-entre-hooks-y-adapters)
  - [Modo de almacenamiento](#modo-de-almacenamiento)
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

---

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

---

# Arquitectura

La aplicación utiliza una arquitectura por capas con una separación explícita entre la interfaz, la lógica de estado y la persistencia.

```text
┌─────────────────────────────────────────────────────────────┐
│                         Componentes                         │
│                                                             │
│  Dashboard · Participants · Courses · Tags · Templates      │
│                                                             │
│  Solo UI + eventos + props                                 │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                           Hooks                             │
│                                                             │
│ useAuth · useParticipants · useCourses · useTags             │
│ useTemplates                                                 │
│                                                             │
│ Estado · loading · errors · mutaciones · API pública        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ contrato común
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                         Adapters                            │
│                                                             │
│ ┌─────────────────────┐       ┌──────────────────────────┐ │
│ │ Local adapters      │       │ Supabase adapters        │ │
│ │                     │       │                          │ │
│ │ localStorage        │       │ Supabase / Certificate   │ │
│ │ fetch local         │       │ API / Storage            │ │
│ └─────────────────────┘       └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                             │
                 ┌───────────┴───────────┐
                 ▼                       ▼
        ┌────────────────┐      ┌────────────────────┐
        │  localStorage  │      │ Supabase / API     │
        └────────────────┘      └────────────────────┘
```

## Capas

### 1. Componentes

Ubicación:

```text
src/components/
```

Los componentes son responsables únicamente de la interfaz y de la interacción con el usuario.

Sus responsabilidades incluyen:

- Renderizar información.
- Recibir datos mediante `props`.
- Emitir eventos.
- Mostrar estados de carga.
- Mostrar errores.
- Ejecutar callbacks proporcionados por los hooks.

Los componentes **no deben acceder directamente** a:

- Supabase.
- `localStorage`.
- `fetch` para operaciones de persistencia.
- APIs externas.
- SQL.

Ejemplo conceptual:

```js
const {
  courses,
  loading,
  error,
  addCourse,
  updateCourse,
} = useCourses()
```

El componente utiliza la API del hook sin conocer dónde se almacenan los datos.

---

### 2. Hooks

Ubicación:

```text
src/hooks/
```

Los hooks funcionan como la capa de estado y coordinación de la aplicación.

Actualmente incluyen:

```text
useAuth.js
useParticipants.js
useCourses.js
useTags.js
useTemplates.js
```

Los hooks son responsables de:

- Mantener el estado de la UI.
- Exponer estados de carga.
- Exponer errores.
- Ejecutar mutaciones.
- Actualizar el estado después de una operación exitosa.
- Validar errores de alto nivel.
- Seleccionar el adapter correspondiente al modo de almacenamiento.
- Mantener una API pública estable para los componentes.

Los hooks **no deberían contener detalles específicos de Supabase**, como:

```js
supabase
  .from('courses')
  .select(...)
```

ni detalles específicos de `localStorage`, como:

```js
localStorage.getItem(...)
```

Esos detalles pertenecen a los adapters.

---

### 3. Adapters

Ubicación:

```text
src/adapters/
├── local/
└── supabase/
```

Los adapters encapsulan la implementación concreta de persistencia.

Cada dominio tiene un adapter local y uno de Supabase.

Ejemplo:

```text
src/adapters/
├── local/
│   ├── authAdapter.js
│   ├── coursesAdapter.js
│   ├── participantsAdapter.js
│   ├── tagsAdapter.js
│   └── templatesAdapter.js
│
└── supabase/
    ├── authAdapter.js
    ├── coursesAdapter.js
    ├── participantsAdapter.js
    ├── tagsAdapter.js
    └── templatesAdapter.js
```

El hook decide qué implementación utilizar:

```js
const coursesAdapter =
  storageMode === 'local'
    ? coursesLocalAdapter
    : coursesSupabaseAdapter
```

A partir de ese momento, el resto del hook utiliza únicamente el contrato del adapter.

---

# Patrón Adapter

El proyecto utiliza el patrón **Adapter** para desacoplar la lógica de la aplicación de la tecnología de persistencia.

Antes de esta separación, los hooks podían contener directamente llamadas a Supabase o lógica de `localStorage`.

Actualmente:

```text
                 ┌─────────────────┐
                 │    useCourses   │
                 └────────┬────────┘
                          │
                   contrato común
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
┌────────────────────────┐  ┌────────────────────────┐
│ coursesLocalAdapter    │  │ coursesSupabaseAdapter │
└────────────┬───────────┘  └────────────┬───────────┘
             │                           │
             ▼                           ▼
       localStorage                  Supabase
```

Esto permite cambiar la persistencia sin modificar los componentes consumidores.

Por ejemplo:

```js
const {
  courses,
  addCourse,
  updateCourse,
} = useCourses()
```

funciona igual independientemente de si la aplicación utiliza:

```text
VITE_STORAGE_MODE=local
```

o:

```text
VITE_STORAGE_MODE=supabase
```

---

# Contratos entre Hooks y Adapters

Los hooks y adapters tienen un **contrato explícito**.

El hook no necesita conocer cómo el adapter realiza la operación. Solo necesita conocer:

1. El nombre de la operación.
2. Los parámetros que recibe.
3. La estructura del resultado exitoso.
4. La estructura de los errores.

Esto permite que los adapters local y Supabase sean intercambiables.

## Contrato general de resultados

### Éxito con entidad

Cuando una operación crea o modifica una entidad, el adapter devuelve directamente la entidad:

```js
{
  id: '123',
  name: 'Curso de ejemplo',
  active: true
}
```

Por ejemplo:

```js
const result =
  await coursesAdapter.addCourse(form)
```

El hook puede entonces hacer:

```js
setCourses(prev => [
  ...prev,
  result,
])
```

---

### Éxito sin entidad

Cuando una operación no tiene una entidad natural que devolver, se utiliza:

```js
{
  id: '123',
  deleted: true
}
```

Esto se utiliza principalmente para eliminaciones.

Ejemplo:

```js
const result =
  await tagsAdapter.remove(id)
```

Resultado:

```js
{
  id,
  deleted: true,
}
```

---

### Error

Todos los adapters deben normalizar sus errores al siguiente formato:

```js
{
  error: {
    message: 'Descripción del error',
    code: 'ERROR_CODE'
  }
}
```

Ejemplo:

```js
{
  error: {
    message: 'La etiqueta no existe.',
    code: 'TAG_NOT_FOUND'
  }
}
```

El hook puede entonces manejar cualquier adapter de la misma manera:

```js
if (result?.error) {
  setError(result.error)
  return result
}
```

El componente recibe el mismo formato independientemente de si el error proviene de:

- Supabase.
- `localStorage`.
- Una validación local.
- Una API externa.

---

# Contratos por dominio

## `useCourses`

El hook utiliza:

```js
coursesAdapter.getCourses()
coursesAdapter.addCourse(form)
coursesAdapter.updateCourse(id, form)
coursesAdapter.deleteCourse(id)
coursesAdapter.toggleActive(id, active)
```

Los adapters deben implementar estas operaciones.

### Resultados

```text
getCourses()
    └── Course[]

addCourse()
    └── Course

updateCourse()
    └── Course

deleteCourse()
    └── { id, deleted: true }

toggleActive()
    └── Course

Cualquier operación
    └── { error: { message, code } }
```

---

## `useTags`

El hook utiliza:

```js
tagsAdapter.getAll()
tagsAdapter.add(name, color)
tagsAdapter.update(id, name, color)
tagsAdapter.remove(id)
```

### Resultados

```text
getAll()
    └── Tag[]

add()
    └── Tag

update()
    └── Tag

remove()
    └── { id, deleted: true }

Cualquier operación
    └── { error: { message, code } }
```

---

## `useAuth`

El hook utiliza:

```js
authAdapter.getSession()
authAdapter.onAuthStateChange(callback)
authAdapter.signIn(email, password)
authAdapter.signOut()
```

### Resultados

La sesión inicial puede devolver:

```js
{
  user
}
```

o:

```js
{
  error: {
    message,
    code
  }
}
```

Las mutaciones mantienen el mismo contrato de éxito/error.

---

## `useTemplates`

El hook utiliza adapters creados mediante factory:

```js
createTemplatesLocalAdapter()
createTemplatesSupabaseAdapter()
```

El contrato es:

```js
adapter.list()
adapter.loadContent(template)
adapter.upload(file, meta)
adapter.remove(id)
```

### Resultados

```text
list()
    └── Template[]

loadContent()
    └── sanitized SVG string

upload()
    └── Template

remove()
    └── { id, deleted: true }

Cualquier operación
    └── { error: { message, code } }
```

Los templates integrados (`is_builtin`) son tratados como entidades de solo lectura.

---

# Reglas para implementar un nuevo Adapter

Si se agrega un nuevo dominio, se debe crear el adapter para cada modo de almacenamiento.

Ejemplo:

```text
src/adapters/local/reportsAdapter.js
src/adapters/supabase/reportsAdapter.js
```

Ambos deben exponer exactamente las mismas operaciones públicas.

Por ejemplo:

```js
reportsAdapter.getReports()
reportsAdapter.createReport(data)
reportsAdapter.deleteReport(id)
```

El hook no debería tener código diferente dependiendo del adapter.

Evitar:

```js
if (storageMode === 'local') {
  // lógica específica de localStorage
} else {
  // lógica específica de Supabase
}
```

dentro de cada operación del hook.

Preferir:

```js
const result =
  await reportsAdapter.createReport(data)
```

y dejar que el adapter resuelva la implementación concreta.

---

# Reglas de errores

Los adapters son responsables de transformar errores específicos de su tecnología al contrato común.

Por ejemplo, un error de Supabase:

```js
{
  code: '23505',
  message: 'duplicate key value violates unique constraint'
}
```

debe convertirse en un error consumible por el hook:

```js
{
  error: {
    message: 'El registro ya existe.',
    code: 'DUPLICATE_RECORD'
  }
}
```

El objetivo es evitar que los componentes conozcan códigos internos de PostgreSQL, Supabase o APIs externas.

---

# Modo de almacenamiento

La aplicación utiliza:

```text
VITE_STORAGE_MODE
```

para determinar el adapter activo.

Valores soportados:

```text
supabase
local
```

La selección se realiza centralmente mediante:

```js
import { storageMode } from '../lib/supabase.js'
```

## Modo Supabase

```env
VITE_STORAGE_MODE=supabase
```

Utiliza:

```text
src/adapters/supabase/
```

La persistencia principal se realiza mediante Supabase y, cuando corresponde, mediante la Certificate API.

Este es el modo utilizado en producción.

---

## Modo local

```env
VITE_STORAGE_MODE=local
```

Utiliza:

```text
src/adapters/local/
```

La información se almacena en `localStorage` o en memoria, dependiendo del dominio.

Este modo está destinado exclusivamente al desarrollo, demos y pruebas de UI.

No debe utilizarse como mecanismo de persistencia de producción.

---

# Manejo seguro de configuración

La aplicación no debe asumir que Supabase está configurado.

En producción:

```text
Supabase configurado
        │
        ▼
  storageMode=supabase
        │
        ▼
Supabase adapters
```

Si la configuración es inválida, la aplicación debe fallar de forma segura en lugar de activar silenciosamente `localStorage`.

El uso de `localStorage` debe ser explícito:

```env
VITE_STORAGE_MODE=local
```

Esto evita que una configuración incompleta de producción pueda provocar que los datos aparentemente se guarden correctamente en el navegador cuando en realidad nunca llegaron a la base de datos.

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

participant_courses (
  participant_id,
  course_id,
  enrolled_at,
  pk (participant_id, course_id)
)

participant_tags (
  participant_id,
  tag_id,
  pk (participant_id, tag_id)
)
```

- **RLS activo en todas las tablas.**
- Las relaciones N:N utilizan claves foráneas con `ON DELETE CASCADE`.
- `updated_at` se mantiene mediante el trigger `set_updated_at()`.

Las migraciones versionadas viven en:

```text
supabase/migrations/
```

El seed inicial está en:

```text
supabase/seed.sql
```

**No reejecutar el seed en producción**, ya que contiene registros sujetos a restricciones `UNIQUE`.

---

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

---

## Variables de entorno

| Variable | Para qué | Obligatoria |
|---|---|---|
| `VITE_STORAGE_MODE` | Selecciona `supabase` o `local` | Sí |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | Sí en modo Supabase |
| `VITE_SUPABASE_ANON_KEY` | Publishable key | Sí en modo Supabase |

Ejemplo:

```env
VITE_STORAGE_MODE=local
```

o:

```env
VITE_STORAGE_MODE=supabase
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## Workflows

### 📥 Importar participantes desde CSV

1. Generar el CSV.
2. Abrir **Importar CSV**.
3. Seleccionar el archivo.
4. Revisar el preview.
5. Confirmar la importación.

El sistema identifica participantes existentes mediante email y cédula.

La operación es idempotente para evitar duplicados.

---

### 📤 Generar reporte PDF

1. Abrir **Exportar datos**.
2. Seleccionar **Reporte PDF**.
3. Elegir las secciones.
4. Generar el reporte.

El reporte contiene:

- Resumen general.
- Desglose por curso.
- Desglose por etiqueta.
- Lista de participantes.

---

### 🗄️ Aplicar una nueva migración Supabase

Las migraciones deben versionarse:

```text
supabase/migrations/
```

Crear una nueva:

```bash
touch supabase/migrations/$(date -u +%Y%m%d%H%M%S)_descripcion.sql
```

Aplicar:

```bash
supabase db push
```

Antes de realizar cambios remotos, se recomienda validar las migraciones y el seed en un entorno local de Supabase.

---

### 🧬 Regenerar tipos TypeScript

```bash
supabase gen types typescript \
  --project-id qhmynvpgmrupqzojcvua \
  > src/lib/database.types.ts
```

El proyecto continúa siendo JavaScript; estos tipos sirven como referencia y documentación del esquema.

---

## Deploy

### Auto-deploy

Cada push a `main` dispara un deploy en Vercel.

```bash
npx vercel@latest list
```

### Deploy manual

```bash
npx vercel@latest deploy --prod --yes
```

### Variables de entorno

```bash
npx vercel@latest env ls
npx vercel@latest env add MI_VAR production
npx vercel@latest env rm MI_VAR production --yes
```

Las variables de Supabase deben estar configuradas correctamente para Production.

**Producción no debe depender del modo `local`.**

---

## Convenciones de código

- **Idioma:** UI, commits y comentarios en español.
- **Identificadores:** inglés.
- **Componentes:** PascalCase.
- **Hooks:** `useXxx`.
- **Utilidades:** camelCase.
- **Estilos:** CSS variables.
- **Persistencia:** siempre mediante adapters.
- **Componentes:** no acceden directamente a la persistencia.
- **Hooks:** no contienen detalles específicos de Supabase o `localStorage`.
- **Adapters:** implementan la persistencia concreta.
- **Contratos:** los adapters de un mismo dominio deben exponer la misma API.
- **Errores:** deben respetar `{ error: { message, code } }`.
- **Mutaciones exitosas:** devuelven la entidad modificada o `{ id, deleted: true }`.
- **Commits:** Conventional Commits.
- **PRs:** features mediante branch + PR.

---

## Regla arquitectónica principal

Toda nueva funcionalidad que requiera persistencia debe seguir el flujo:

```text
Componente
    ↓
Hook
    ↓
Adapter
    ↓
Persistencia
```

No se debe implementar:

```text
Componente
    ↓
Supabase
```

ni:

```text
Componente
    ↓
localStorage
```

Tampoco se debe implementar:

```text
Hook
    ↓
Supabase directamente
```

cuando la operación corresponda a una responsabilidad del adapter.

La separación permite mantener una única API para la aplicación independientemente de la tecnología utilizada para almacenar los datos.

---

## Troubleshooting

### La aplicación queda en blanco

Revisar:

```bash
npm run build
npm run lint
```

y la consola del navegador.

Si `VITE_STORAGE_MODE=supabase`, verificar que existan:

```env
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

---

### La aplicación utiliza localStorage inesperadamente

Verificar:

```env
VITE_STORAGE_MODE
```

Debe ser explícitamente:

```env
VITE_STORAGE_MODE=local
```

para utilizar persistencia local.

En producción debe utilizarse:

```env
VITE_STORAGE_MODE=supabase
```

---

### "Cargando…" infinito tras login

Verificar las variables:

```bash
npx vercel@latest env ls
```

y confirmar que el entorno correspondiente tenga las variables de Supabase.

---

### Error `PGRST303`

Es un error relacionado con desfase de reloj entre Supabase Auth y PostgREST.

El cliente Supabase implementa retry automático.

Si persiste:

1. Revisar la hora del sistema.
2. Recargar la aplicación.
3. Verificar la sesión.
4. Revisar los logs de Supabase.

---

### CRUD devuelve un error

Los hooks esperan que los adapters respeten el contrato:

```js
{
  error: {
    message,
    code
  }
}
```

Si un nuevo adapter devuelve directamente un error de Supabase o una excepción no normalizada, debe corregirse en el adapter y no en cada componente consumidor.

---

## Decisiones de alcance

Cosas que **NO** están en alcance actualmente:

- ❌ Custom domain.
- ❌ Backups automáticos.
- ❌ Multi-admin / roles diferenciados.
- ❌ Sentry / monitoreo externo.
- ❌ Integración con OpenAI.

Si alguna de estas decisiones cambia, deben revisarse las implicaciones arquitectónicas y de seguridad correspondientes.

---

## Estado de la arquitectura

La arquitectura de persistencia se encuentra separada mediante el patrón Adapter:

```text
                 Aplicación
                     │
                     ▼
                  Hooks
                     │
             contrato común
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
   Local Adapters         Supabase Adapters
          │                     │
          ▼                     ▼
     localStorage          Supabase/API
```

Esto permite:

- Mantener los componentes independientes de la persistencia.
- Ejecutar la aplicación en modo local para desarrollo.
- Ejecutar producción contra Supabase.
- Sustituir la tecnología de persistencia sin modificar la API pública de los hooks.
- Normalizar los errores.
- Mantener estados de carga y error consistentes.
- Reducir el acoplamiento entre UI y backend.
- Facilitar pruebas de los hooks y adapters de manera independiente.

---

## Contacto

**TEC Emprende Lab — Instituto Tecnológico de Costa Rica**

📧 tecemprendelab@itcr.ac.cr  
📞 2550-9270

<sub>Hecho con ☕ en Costa Rica.</sub>
# Arquitectura

La aplicación utiliza una arquitectura por capas con una separación explícita entre la interfaz, la lógica de estado y la persistencia.

> Este documento vive en `docs/`. La visión general rápida está en el [README](../README.md).

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

## Patrón Adapter

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

## Contratos entre Hooks y Adapters

Los hooks y adapters tienen un **contrato explícito**.

El hook no necesita conocer cómo el adapter realiza la operación. Solo necesita conocer:

1. El nombre de la operación.
2. Los parámetros que recibe.
3. La estructura del resultado exitoso.
4. La estructura de los errores.

Esto permite que los adapters local y Supabase sean intercambiables.

### Contrato general de resultados

#### Éxito con entidad

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

#### Éxito sin entidad

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

#### Error

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

## Contratos por dominio

### `useCourses`

El hook utiliza:

```js
coursesAdapter.getCourses()
coursesAdapter.addCourse(form)
coursesAdapter.updateCourse(id, form)
coursesAdapter.deleteCourse(id)
coursesAdapter.toggleActive(id, active)
```

Los adapters deben implementar estas operaciones.

Resultados:

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

### `useTags`

El hook utiliza:

```js
tagsAdapter.getAll()
tagsAdapter.add(name, color)
tagsAdapter.update(id, name, color)
tagsAdapter.remove(id)
```

Resultados:

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

### `useAuth`

El hook utiliza:

```js
authAdapter.getSession()
authAdapter.onAuthStateChange(callback)
authAdapter.signIn(email, password)
authAdapter.signOut()
```

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

### `useTemplates`

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

Resultados:

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

## Reglas para implementar un nuevo Adapter

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

## Reglas de errores

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

## Modo de almacenamiento

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

### Modo Supabase

```env
VITE_STORAGE_MODE=supabase
```

Utiliza:

```text
src/adapters/supabase/
```

La persistencia principal se realiza mediante Supabase y, cuando corresponde, mediante la Certificate API.

Este es el modo utilizado en producción.

### Modo local

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

## Manejo seguro de configuración

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

## Decisiones de alcance

Cosas que **NO** están en alcance actualmente:

- ❌ Custom domain.
- ❌ Backups automáticos.
- ❌ Multi-admin / roles diferenciados.
- ❌ Sentry / monitoreo externo.
- ❌ Integración con OpenAI.

Si alguna de estas decisiones cambia, deben revisarse las implicaciones arquitectónicas y de seguridad correspondientes.

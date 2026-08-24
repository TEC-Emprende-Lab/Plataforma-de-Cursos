# Base de datos

Esquema, migraciones y utilidades de Supabase.

> Este documento vive en `docs/`. La visión general rápida está en el [README](../README.md).

## Esquema

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

## Aplicar una nueva migración Supabase

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

## Regenerar tipos TypeScript

```bash
supabase gen types typescript \
  --project-id qhmynvpgmrupqzojcvua \
  > src/lib/database.types.ts
```

El proyecto continúa siendo JavaScript; estos tipos sirven como referencia y documentación del esquema.

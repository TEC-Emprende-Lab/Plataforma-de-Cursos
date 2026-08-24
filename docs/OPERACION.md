# Operación

Guías de uso diario, despliegue y solución de problemas.

> Este documento vive en `docs/`. La visión general rápida está en el [README](../README.md).

## Importar participantes desde CSV

1. Generar el CSV.
2. Abrir **Importar CSV**.
3. Seleccionar el archivo.
4. Revisar el preview.
5. Confirmar la importación.

El sistema identifica participantes existentes mediante email y cédula.

La operación es idempotente para evitar duplicados.

---

## Generar reporte PDF

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

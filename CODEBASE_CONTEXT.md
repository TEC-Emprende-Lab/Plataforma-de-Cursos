# Contexto técnico persistente de la codebase

> Mapa de orientación rápida. No reemplaza al código ni a `ROADMAP.md`.
> Última actualización: 2026-08-19.

Estado operativo: Fases 0 a 3 completadas; Fases 2 y 3 ya fueron integradas en
`main`. La rama `phase/3-validation` contiene correcciones posteriores al merge
y requiere Pull Request, checks remotos y confirmación del propietario. La
siguiente fase de implementación es la Fase 4.

## Propósito del sistema

SPA administrativa del TEC Emprende Lab para gestionar participantes, cursos, vigencias de acceso, recordatorios, etiquetas, importación/exportación y generación de certificados.

No es un LMS: no aloja contenido de cursos. La vigencia se calcula a partir de la fecha del participante y del máximo `accessDays` entre sus cursos.

## Arquitectura acordada

```text
React 18 + Vite (Vercel)
  ├─ Supabase Auth: sesión de administradores
  ├─ Supabase Postgres: participantes, cursos, etiquetas y relaciones
  ├─ Supabase Storage/Postgres: plantillas SVG personalizadas
  └─ Flask en Render
       ├─ transformación y render de SVG
       ├─ PDF/PNG/ZIP
       ├─ mapeo opcional con IA
       └─ consulta externa de cédulas
```

Supabase es la fuente de verdad. El modo `localStorage` debe quedar explícitamente limitado a desarrollo. Flask no se reemplaza ni se migra a otro framework.

## Puntos de entrada

- Frontend HTML: `index.html`.
- Frontend React: `src/main.jsx` → `src/App.jsx`.
- Backend Flask: `backend/app.py`.
- Configuración frontend externa: `src/config.js`.
- Selección/validación de persistencia: `src/lib/config.js`.
- Cliente Supabase: `src/lib/supabase.js`.
- Esquema versionado: `supabase/migrations/`.
- Esquema de plantillas: migración `20260812000000_secure_svg_templates.sql`; `supabase_setup.sql` queda como referencia compatible.

`vercel.json` conserva un rewrite de `/api/*`, pero no existe una carpeta `api/` ni funciones serverless. Las llamadas de certificados usan la URL absoluta de Render. No deben añadirse llamadas relativas `/api/...` suponiendo que Vercel las redirige a Flask.

## Estructura relevante

```text
src/
  App.jsx                  Orquestador, guard de sesión y router interno.
  adapters/                Implementaciones equivalentes para Supabase y modo local.
  components/              Vistas y componentes React.
  hooks/                   Estado y mutaciones de datos.
  lib/supabase.js          Singleton Supabase y retry de PGRST303.
  utils/                   Fechas, cédulas, correo, PDF, Excel/CSV y concurrencia.
  data/                    Constantes y datos iniciales del modo local.
backend/
  app.py                   API Flask monolítica actual.
  auth.py                  Verificación ES256/JWKS de sesiones Supabase.
  svg_security.py          Frontera de validación de SVG y CSS.
  template_storage.py      Escritura confiable de plantillas mediante service role.
  templates/               SVG incorporados y firma.
  fonts/                   Fuentes usadas al renderizar certificados.
  requirements.txt         Dependencias Python de producción.
  Dockerfile               Imagen desplegable del servicio.
supabase/
  migrations/              Esquema principal y cambios versionados.
                            La migración 20260819000000 endurece y amplía las RPC de participantes.
  seed.sql                 Datos iniciales; no ejecutar indiscriminadamente en producción.
public/templates/          Copias estáticas de plantillas para preview frontend.
docs/                      Diseño, revisión técnica histórica y capturas.
.github/workflows/         Análisis de calidad y seguridad en GitHub Actions.
```

## Integración continua y documentos de auditoría

`origin/main` incluye dos workflows que se ejecutan en pushes y Pull Requests hacia `main` o `develop`:

- `.github/workflows/lint-and-static.yml`: ESLint y Semgrep.
- `.github/workflows/security-scan.yml`: Trivy y TruffleHog.

Están configurados para publicar resultados SARIF en GitHub Code Scanning. `docs/CI-PIPELINE.md` explica su alcance y `docs/QA-FINDINGS.md` conserva la instantánea de hallazgos del 2026-08-11. Estos controles todavía son parcialmente informativos: no incluyen build ni tests y varios pasos permiten continuar tras detectar problemas. No deben interpretarse como garantía de que un cambio es integrable.

`ci-setup/eslint.config.js` es un artefacto auxiliar agregado junto con el pipeline; no es la configuración ESLint activa de la aplicación. La configuración efectiva sigue siendo `eslint.config.js` en la raíz.

## Flujo Git acordado

No trabajar directamente sobre `main`. Cada fase o cambio acotado debe seguir este flujo:

1. Actualizar referencias remotas y crear una rama dedicada desde `main` al día.
2. Implementar y ejecutar las validaciones locales aplicables al alcance autorizado; documentar los fallos que pertenezcan a la línea base.
3. Abrir un Pull Request hacia `main`.
4. Atender checks remotos y revisión de al menos un subagente independiente adecuado (Claude/Sonnet si está disponible); no ocultar fallos existentes ni regresiones.
5. Solicitar confirmación del propietario antes del merge; los checks requeridos deben estar verdes y no puede haber regresiones nuevas.

La rama `main` debe configurarse en GitHub con protección contra pushes directos y checks requeridos cuando dichos checks sean suficientemente confiables.

## Flujo de la aplicación React

`App` llama `useAuth`. Si Supabase está configurado, espera la sesión y presenta `LoginView` cuando no hay usuario. `AuthenticatedApp` carga `useParticipants`, `useCourses` y `useTags`, mantiene la vista activa en estado y pasa datos/callbacks por props.

Vistas principales:

- `Dashboard.jsx`: estadísticas, cursos activos y participantes recientes.
- `ParticipantsView.jsx` + `ParticipantModal.jsx`: CRUD, filtros y verificación de cédulas.
- `ProfileView.jsx`: detalle, vigencia, etiquetas, notas y recordatorios.
- `CoursesView.jsx` + `CourseModal.jsx`: CRUD de cursos.
- `AccessView.jsx`: estado de vigencias y renovaciones.
- `RemindersView.jsx`: ventana de prueba y correo prellenado.
- `TagsView.jsx`: CRUD de etiquetas.
- `ImportView.jsx`: parsing CSV, deduplicación y actualización masiva.
- `ExportView.jsx`: Excel, CSV y PDF.
- `CertificatesView.jsx`: generación individual/lote; archivo muy grande y acoplado.
- `GalleryView.jsx`: CRUD y preview de plantillas SVG.

No existe un router de URL: `App.jsx` usa una clave de vista en estado local.

## Contratos de datos

### Participante en la aplicación

```text
{
  id, name, cedula, email, phone,
  status, payment, access, fecha, notes,
  courses: [courseId], tags: [tagId]
}
```

Persistencia: `participants`, `participant_courses`, `participant_tags`.

### Curso en la aplicación

```text
{
  id, name, short, type, platform,
  start, end, capacity, price, modalidad,
  code, description, active, accessDays, certEnabled
}
```

El hook adapta `start_date/end_date/access_days/cert_enabled` de la base de datos a nombres camelCase usados por React.

### Etiqueta

```text
{ id, name, color }
```

### Plantilla

Metadata en `svg_templates`, archivo en bucket `certificate-templates`, o SVG incorporado en el repositorio. Campos relevantes: `name_id`, `date_id`, `storage_path`, `is_builtin`.

## Hooks y responsabilidades

- `useAuth`: sesión, login y logout mediante el adapter seleccionado.
- `useParticipants`: estado y mutaciones; delega persistencia y relaciones N:N al adapter local o Supabase.
- `useCourses`: estado CRUD; la adaptación DB ↔ UI vive en los adapters.
- `useTags`: estado CRUD sobre el adapter seleccionado.
- `useTemplates`: metadata y contenido SVG mediante adapters; Supabase conserva las escrituras confiables a través de Flask.
- `useTheme`: preferencia visual en `localStorage`; no es persistencia de dominio.
- `useGlobalShortcut`: registra atajos globales de teclado, incluido el acceso a la paleta de comandos.

Las mutaciones de ambos modos usan el contrato: entidad en éxitos con entidad,
`{ id, deleted: true }` en eliminaciones y `{ error: { message, code } }` en
errores. Los callers deben esperar el resultado antes de cerrar UI o anunciar
éxito.

## Persistencia actual y objetivo

Estado actual y objetivo cumplido:

- `VITE_STORAGE_MODE=supabase` exige `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- `VITE_STORAGE_MODE=local` solo es válido en desarrollo; producción lo rechaza.
- La ausencia o invalidez del modo muestra un fallo de configuración antes de importar `App`.
- Cada ejecución usa exactamente un adapter; no existe fallback automático ni sincronización entre Supabase y `localStorage`.
- La preferencia de tema sigue usando `localStorage`, lo cual es aceptable y no constituye persistencia de dominio.

## Autenticación y autorización

El frontend usa Supabase Auth con correo/contraseña. Las políticas de las migraciones principales permiten CRUD al rol `authenticated` y bloquean `anon` por ausencia de políticas.

El backend Flask verifica JWT ES256 contra el JWKS público de Supabase en todas
las rutas `POST`. Permanecen públicos los health checks y la lectura validada de
plantillas incorporadas. El frontend usa `certificateApiFetch` para adjuntar la
sesión sin fijar manualmente el `Content-Type` de `FormData`.

La migración `20260812000000_secure_svg_templates.sql` formaliza tabla, bucket y
RLS de plantillas. El bucket conserva lectura pública para previews, pero usuarios
`anon`/`authenticated` no pueden escribir: upload/delete pasan por Flask, que
valida JWT y SVG antes de usar `SUPABASE_SERVICE_ROLE_KEY` solo en servidor.

Las altas y ediciones de participantes con cursos/etiquetas usan RPC
transaccionales. `20260819000000_harden_participant_transactions.sql` mantiene
`SECURITY INVOKER`, restringe ejecución a `authenticated`, rechaza IDs
inexistentes y añade `bulk_update_participants_with_courses` para que los campos
y cursos posteriores a una importación se confirmen o reviertan juntos.

## Backend Flask

Rutas actuales:

| Método | Ruta | Responsabilidad |
|---|---|---|
| GET | `/api/health` | Estado de Cairo e IA. |
| GET | `/api/ai/status` | Disponibilidad de proveedor IA. |
| GET | `/api/templates` | Lista de SVG incorporados. |
| GET | `/api/templates/<filename>` | Devuelve SVG incorporado. |
| POST | `/api/analyze` | Detecta elementos con ID. |
| POST | `/api/preview` | Completa y devuelve SVG. |
| POST | `/api/generate` | Genera PDF o PNG. |
| POST | `/api/generate/batch` | Convierte CSV en ZIP. |
| POST | `/api/ai/mapeo` | Sugiere mapeo de IDs mediante IA. |
| POST | `/api/cedulas/lookup` | Consulta nombres en servicios externos. |
| POST | `/api/templates/upload` | Valida y persiste un SVG mediante la frontera confiable. |
| POST | `/api/templates/delete` | Elimina metadata/objeto mediante la frontera confiable. |

Pipeline aproximado de certificado:

```text
SVG incorporado/subido
 → correcciones específicas de exportación
 → inyección de firma
 → detección/reemplazo de campos
 → embebido de fuentes
 → CairoSVG a PNG
 → Pillow a PDF, o ZIP para lote
```

El backend detecta tipos de certificado mediante IDs y palabras dentro del XML; es un punto frágil que debe reemplazarse gradualmente por metadata explícita.

## Integraciones externas

- Supabase PostgREST, Auth y Storage.
- Backend Flask desplegado actualmente en Render; URL hardcodeada en `src/config.js`.
- Hacienda y Suite Tecnológica para consulta de cédulas desde Flask.
- `apis.gometa.org/cedulas` desde algunas vistas frontend.
- Anthropic preferido y OpenAI como fallback en Flask para mapeo/corrección opcional.
- Vercel para la SPA.

Nunca registrar claves, JWT, cédulas completas en logs de depuración ni contenido de participantes en reportes técnicos.

## Lógica temporal

`src/utils/time.js` es la fuente de verdad prevista para:

- días transcurridos/restantes;
- advertencia y expiración;
- fechas de expiración y prueba;
- resolución de `accessDays` según cursos.

Regla vigente: si hay varios cursos, se usa el máximo `accessDays`; fallback global: 45 días.

Deuda conocida: `TODAY` queda congelado al importar el módulo y la revocación inicial en `useParticipants` no usa los días por curso.

## Riesgos que un agente debe conocer antes de editar

- Preservar el diff local preexistente en `backend/app.py`.
- No ejecutar seed ni migraciones contra producción durante desarrollo.
- Aplicar `20260819000000_harden_participant_transactions.sql` antes de desplegar código que invoque la RPC masiva.
- No probar CRUD con datos reales.
- No renderizar SVG no confiable sin sanitización.
- No asumir que un build exitoso implica que lint, tests o flujos visibles pasan.
- No asumir que un workflow exitoso implica ausencia de hallazgos: los análisis actuales permiten continuar en varios pasos y priorizan evidencia SARIF.
- No hacer commits directos ni merge automático a `main`; trabajar por rama y PR, con confirmación del propietario.
- No aplicar una reestructuración masiva a `app.py` o `CertificatesView.jsx`; extraer por etapas con pruebas.
- No confiar ciegamente en documentos históricos cuando contradigan migraciones o código actual.
- La exportación usa ExcelJS mediante importación dinámica; `xlsx` ya no forma parte del proyecto.
- Las referencias antiguas de documentación a `api/analyze.js`, funciones serverless Vercel y una migración futura a Supabase son obsoletas; el código vigente usa Flask en Render y Supabase ya está activo.

## Línea base y comandos

Desde la raíz del repositorio:

```text
npm run lint   # pasa con 0 errores; conserva 14 advertencias conocidas
npm run build  # pasa con advertencia de chunk grande
```

GitHub Actions ejecuta actualmente análisis ESLint/Semgrep y Trivy/TruffleHog en `main` y `develop`. Aún debe añadirse una puerta completa con build, pruebas y build de Docker.

Red de pruebas disponible:

```text
npm test          # 51 pruebas Vitest frontend
npm run lint      # 0 errores; 14 advertencias conocidas
npm run build     # build de producción

cd backend
../.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
../.venv/Scripts/python.exe -m pytest   # 104 pruebas backend
```

Las pruebas backend bloquean red y efectos laterales, simulan Cairo y no usan
credenciales ni datos de producción. Las dependencias directas están fijadas;
`pip check`, `pip-audit` y `npm audit` pasan sin vulnerabilidades conocidas.
La generación real PDF/PNG/ZIP y Gunicorn también tienen smoke local en Linux.

## Protocolo de reanudación

Cuando el usuario diga “reanuda el trabajo”:

1. Leer `ROADMAP.md` completo.
2. Leer este archivo completo.
3. Revisar `git status` y preservar cambios ajenos.
4. Confirmar que se trabaja en una rama dedicada creada desde `main` actualizado.
5. Identificar la primera tarea pendiente de la fase activa.
6. Ejecutarla y validarla según su puerta de salida.
7. Solicitar revisión independiente cuando corresponda.
8. Abrir o actualizar el Pull Request; no integrar sin confirmación del propietario.
9. Actualizar ambos documentos antes de cambiar de fase.

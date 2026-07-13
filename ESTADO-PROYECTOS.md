# Estado de Proyectos — TEC Emprende Lab

Documento de continuidad. Léelo al inicio de la siguiente sesión para
retomar el trabajo sin perder contexto. Complementa a `ECOSISTEMA.md`
(arquitectura del ecosistema de identidad compartida), que vive en el
repo `plataformadepersonasemprendedoras`.

> Última revisión: sesión del 2026-07-13. Actualizar esta fecha y las
> secciones que cambien en cada sesión futura.

---

## Índice de repositorios

| Repo | Rol | Stack | Estado auth |
|---|---|---|---|
| `plataformadepersonasemprendedoras` | Diagnóstico de emprendimiento | Next.js 16 + Supabase | ✅ Login + roles admin/facilitador |
| `Plataforma-de-Cursos` | Gestión de participantes y cursos | Vite + React + Supabase | ✅ Login (ya existía, bien hecho) |
| `sbd-ronda3-compras` | Control de compras/trámites SBD R3 | Next.js + Supabase | ✅ Login agregado — ⚠️ RLS sin correr |
| `PaginaWebEventos` | Web pública de eventos | Next.js 14 + Firebase | ✅ Login admin (server-side sólido) |
| `Catalitec`, `Catalitec-tracker`, `Forms-Personalidad` | — | — | **Fuera de alcance** — el usuario pidió explícitamente no revisarlos |

**Dato importante de infraestructura:** `Plataforma-de-Cursos` y
`sbd-ronda3-compras` **comparten el mismo proyecto de Supabase**
(`qhmynvpgmrupqzojcvua` — contiene tanto las tablas `participants`/`courses`
como `tramites`/`projects`). No son bases separadas.

---

## 1. Diagnóstico de Emprendimiento (`plataformadepersonasemprendedoras`)

**Qué hace:** formulario público de diagnóstico para emprendedoras (línea
base + medición final), scoring por módulos, recomendaciones con IA
(OpenAI), reportes por programa, exportación a CSV/PDF, panel admin con
gestión de usuarios y preguntas del formulario.

**Proyecto Supabase:** `slgouphrtilddbrzkwab` (organización
"Tranferencia de conocimientos", plan **Free** — 500 MB, ~24k personas de
capacidad estimada, ver detalle de cálculo en el historial de sesión).

**Hecho en sesiones recientes:**
- Sistema de roles **admin / facilitador** vía `app_metadata` de Supabase
  (seguro, solo editable server-side). Facilitadores no ven "Configuración".
- Flujo de invitación arreglado de punta a punta: `site_url`/redirect de
  Supabase Auth apuntaban a `localhost` (corregido vía API de gestión),
  se creó `/set-password` (excluida del middleware porque el token de
  invitación llega en el hash de la URL, que el servidor nunca ve), y se
  corrigió un bug donde `/set-password` podía cambiar la contraseña de
  la sesión activa del navegador en vez de la del usuario invitado
  (ahora fuerza `setSession()` desde el hash).
- Rate limit de email de Supabase (2/hora en plan Free sin SMTP propio) —
  **pendiente decidir** si configurar SMTP propio (Resend, etc.) o seguir
  esperando el reset.
- Reportes: auto-selección de programa vía `?program=id` en la URL.
- Toast de confirmación en guardados clave (perfil, programa, preguntas).
- Edición inline de nombres de módulo/sección en "Formulario".
- CSV de exportación: se corrigió la columna de cédula (estaba vacía).
- Filtro por territorio en la lista de emprendedoras.
- Botón "Exportar a cursos" — CSV con el formato exacto que espera el
  importador de `Plataforma-de-Cursos` (Cédula, Nombre y apellidos,
  Teléfono, Correo — solo dígitos, sin comillas).
- **`lib/cedula.ts`** — módulo de normalización de cédula (ver `ECOSISTEMA.md`).
  Es la llave universal del ecosistema. Integrado en registro, edición y
  el formulario público (el público *no* normalizaba antes — se corrigió,
  porque si no habría creado duplicados de persona según por dónde entrara).
- Fix de tooltip del gráfico de distribución por madurez (mostraba
  "Emprendedoras: N" en vez del nombre del nivel).
- **`ECOSISTEMA.md`** documentando la arquitectura completa: cédula como
  llave, dueño de cada dato, contratos de API, modelo de la Cursos nueva,
  riesgos abiertos.

**Pendiente / próximos pasos:**
- [ ] Decidir sobre SMTP propio para invitaciones (evitar el rate limit de 2/hora).
- [ ] Backfill de cédulas en reposo (la tabla `entrepreneurs` no tenía
  cédulas guardadas al momento de agregar la normalización, así que no
  hizo falta backfill — **verificar si ya hay datos nuevos sin normalizar**
  si se cargó algo por fuera del flujo normal).
- [ ] Exponer los contratos de API de solo-lectura descritos en
  `ECOSISTEMA.md` §5 (`GET /api/personas/{cedula}/diagnostico`).

---

## 2. Plataforma de Cursos / Participantes (`Plataforma-de-Cursos`)

**Qué hace:** gestión de participantes de programas (no es un LMS — no
aloja contenido de cursos), control de acceso con ventana de vigencia
(`access_days` por curso + `fecha` de inicio → expiración calculada al
vuelo, nunca "se apaga" un registro), importación masiva por CSV con
verificación contra TSE/Hacienda, generación de certificados, exportación.

**Stack:** Vite + React (SPA, sin SSR) — es el único de los repos activos
que no usa Next.js. El login (`useAuth.js` + `LoginView.jsx`) ya estaba
bien resuelto antes de esta ronda de revisiones: Supabase Auth con
correo+contraseña, listener de sesión, manejo de error limpio.

**Hecho en sesiones recientes (esta sesión):**
- **`src/utils/cedula.js`** — réplica exacta de `lib/cedula.ts` del
  Diagnóstico. Integrada en `useParticipants` (guardado normalizado),
  `ImportView` (match contra existentes normalizando ambos lados — así
  los datos viejos sin padding también calzan — y consulta TSE con la
  forma canónica), `ParticipantsView` (verificación TSE), y texto guía
  "con todos los ceros" en `ParticipantModal`.
- Se registró un grupo real de participantes (programa "Mujeres ON") en
  los cursos de Marketing y Costos vía CSV generado a partir de un Excel
  del usuario — dos cédulas quedaron marcadas para verificación manual
  (una con letra "C" al inicio, otra con dígito faltante).

**Hecho en otra sesión (no esta — visible en el historial de git, autor
"Claude Opus 4.8"/"Claude Sonnet 4.6" vía commits del 2026-07-03):**
- Fix: `importParticipants` ya no descarta en silencio las filas cuyo
  insert falla — ahora devuelve `{ ids, errors }` y el toast muestra
  cuántas fallaron y por qué.
- Fix: `addCourse`/`updateCourse` devuelven `{ error }` real en vez de
  `null` al fallar, y el toast muestra el mensaje exacto (columna
  inexistente, unique de `code`, **o violación de RLS** — la mención de
  RLS en ese commit sugiere que en algún punto se probó con RLS activo,
  pero no se encontró ninguna migración `ENABLE ROW LEVEL SECURITY` ni
  `CREATE POLICY` en el repo — **ver el punto crítico abajo**).

**🔴 Pendiente crítico — RLS no está activo:**
- Se revisó `supabase/migrations/` completo: hay una migración
  (`20260520161638_revoke_rls_auto_enable_public_execute.sql`) que
  **solo revoca el permiso de ejecutar una función** llamada
  `rls_auto_enable()` vía PostgREST — **no habilita RLS en ninguna
  tabla**. No existe ningún `ENABLE ROW LEVEL SECURITY` ni `CREATE POLICY`
  en el repo.
- El usuario ya fue informado de esto (dijo que la plataforma "está
  pensada para que solo funcione en las oficinas" y decidió **no
  priorizarlo** por ahora). Se le aclaró que la URL es pública en Vercel
  y la anon key viaja en el JS del navegador, así que técnicamente
  cualquiera con el link podría leer/escribir `participants` sin login.
  **Decisión del usuario: dejarlo así por el momento.** No re-abrir el
  tema salvo que el usuario lo pida.

**Otros pendientes:**
- [ ] Backfill de cédulas viejas en `participants` (el código ya compara
  normalizando ambos lados, así que funciona sin backfill, pero convendría
  dejarlas canónicas en reposo cuando haya acceso/tiempo).
- [ ] Verificar las 2 cédulas dudosas del grupo "Mujeres ON" importado
  (Adriana Carranza — le faltaba un 0; Cristhian Hernández — traía una
  "C" al inicio que no debería estar).

---

## 3. Control de Compras SBD Ronda 3 (`sbd-ronda3-compras`)

**Qué hace:** control de trámites (facturas, reintegros, uso de TC) y
presupuesto de los 15 proyectos de SBD Ronda 3. Dashboard, detalle por
proyecto, reportes mensual/general, papelera (soft delete).

**Hecho en esta sesión:**
- **Login agregado desde cero** — el repo no tenía ninguna autenticación
  (cualquier visitante con la URL podía ver/editar todos los trámites).
  Se agregó `/login` (Supabase Auth, mismo patrón que Diagnóstico),
  `middleware.ts` que redirige a `/login` sin sesión, y `AppShell.tsx`
  (oculta nav/footer en login, botón "Salir").
  - Dos rondas de fixes de build: matcher del middleware con anclas `$`
    no soportadas por Next.js, y un `implicit any` en el parámetro
    `cookiesToSet` (faltaba tipar como en `supabase-server.ts`).
  - El usuario ya creó el/los usuario(s) en el dashboard de Supabase y
    confirmó que el login funciona.
- **`supabase/rls.sql` creado** — habilita RLS en `projects` y `tramites`,
  revoca permisos de `anon`, da acceso total solo a `authenticated`.
  Verificado que todo el código de datos pasa por `createServerSupabaseClient`
  o el cliente de navegador con sesión (nunca `service_role` ni anon sin
  sesión), así que el script no debería romper nada al aplicarlo.
  **🔴 El usuario pidió explícitamente dejar esto para después — el
  archivo está listo pero el SQL no se ha corrido en Supabase.**

**Reconciliación con FUNDATEC (trabajo puntual, no de código):**
- Se comparó el excel/HTML "Reporte de Situación Presupuestaria" que
  genera FUNDATEC contra los trámites de la plataforma, proyecto por
  proyecto. Metodología que funcionó: **emparejar por número de factura**
  (los totales agregados engañan porque el "ejecutado" de FUNDATEC incluye
  traslados de presupuesto/contrapartidas que no son trámites de compra).
- Resultado: prácticamente todo cuadra. Único faltante real encontrado:
  **2 facturas de Tropibugs (P67)** que FUNDATEC ejecutó y no están en la
  plataforma (`00600001010000028013` Extreme Technology ₡63,240, y
  `00100004010000021698` Almacén Tres R, monto no leído con confianza).
  **Pendiente: registrarlas** (el usuario no confirmó si ya lo hizo).
- Los archivos de FUNDATEC tenían descargas duplicadas en conflicto para
  varios proyectos (Tropibugs, Naturabite, Visorías) — quedó pendiente
  que el usuario deje una sola descarga vigente por proyecto para poder
  re-verificar con precisión total si se vuelve a pedir.

**Pendiente:**
- [ ] Correr `supabase/rls.sql` cuando el usuario lo priorice.
- [ ] Confirmar si ya se registraron las 2 facturas faltantes de Tropibugs.
- [ ] Replicar `normalizeCedula` en este repo si en algún momento maneja
  cédulas de personas (hoy no gestiona personas, solo trámites/montos,
  así que no aplica por ahora).

---

## 4. Página Web de Eventos (`PaginaWebEventos`)

**Qué hace:** web pública de eventos de TEC Emprende Lab con panel admin
protegido en `/admin` para gestionar el contenido.

**Stack:** Next.js 14 + Firebase (el único repo del ecosistema que no usa
Supabase — su identidad vive en Firebase Auth, separada de todo lo demás).
React 18, CSS plano sin Tailwind (desactualizado frente a los demás).

**Estado del login:** ya es sólido — a diferencia de los otros repos, acá
el login server-side estaba bien hecho desde antes: `/api/auth/login`
verifica el ID token con Firebase Admin, valida contra `ADMIN_EMAILS`
(server-side, no público), cookie `httpOnly`+`secure`+`sameSite`, expira
en 5 días. **No se tocó código en este repo** — solo se revisó y quedaron
mejoras identificadas, sin implementar (el usuario no llegó a pedir que
se ejecutaran):

**Mejoras identificadas, NO implementadas:**
- [ ] **Quitar la pestaña "Crear cuenta" pública** en `/admin` — llama a
  Firebase directo desde el navegador; el check `isEmailAllowed` que la
  protege es solo JS de cliente (bypasseable), permitiendo crear cuentas
  Firebase basura en el proyecto (no da acceso real, pero ensucia el pool
  de usuarios). Mejor gestionar altas desde la consola de Firebase.
- [ ] **Quitar `NEXT_PUBLIC_ADMIN_EMAILS`** — expone la lista de correos
  admin en el bundle público. La validación real ya está server-side
  (`ADMIN_EMAILS` sin prefijo público); el check de cliente es solo
  cosmético y se puede eliminar sin perder nada.
- [ ] Actualizar Next 14 → 16 y React 18 → 19 para alinear con el resto
  del ecosistema (no urgente).
- [ ] Adoptar Tailwind si en algún momento se quiere compartir componentes
  visuales con las otras plataformas.

Repo fuera del ecosistema de identidad (Diagnóstico+Participantes+Cursos)
porque es solo la web pública de eventos, no maneja cédulas de personas.

---

## 5. Ecosistema de identidad compartida — estado del plan

Ver `ECOSISTEMA.md` en `plataformadepersonasemprendedoras` para el
documento completo. Resumen del estado de implementación:

- [x] `normalizeCedula` — Diagnóstico (`lib/cedula.ts`)
- [x] `normalizeCedula` — Participantes (`utils/cedula.js`)
- [ ] `normalizeCedula` — Cursos nueva (no existe aún el repo)
- [ ] Backfill de cédulas en reposo (Diagnóstico no lo necesitó; Participantes
  pendiente cuando haya acceso/tiempo)
- [ ] Contratos de API expuestos por cada plataforma (borrador ya escrito
  en `ECOSISTEMA.md` §5, nada implementado)
- [ ] Webhooks + reconciliación
- [ ] Plataforma de Cursos nueva (repo aparte, Vercel/Supabase propios,
  para alojar contenido/video — decisión tomada: Cloudflare Stream o
  Bunny Stream con URLs firmadas, NO Supabase Storage. Conexión con
  Participantes vía webhook + mirror, no consulta en vivo, por el riesgo
  de que Supabase Free pause el proyecto por inactividad). **Fase 0
  (repo + esquema + RLS) aún no se ha arrancado.**

---

## 6. Repos de terceros revisados (referencia, no de TEC Emprende)

Por pedido explícito del usuario, se revisaron 3 repos externos
(`mau671/claustrum`, `mau671/miaubot`, `mau671/coursia`) para ver qué
se podía reutilizar. Conclusión resumida (detalle completo en el
historial de la sesión si se necesita, no se guardó código de ahí):

- **Claustrum** (plataforma académica del TEC, madura): lo más
  aprovechable de los tres. Better Auth (magic link, 2FA, OAuth, JWT) más
  completo que el patrón manual usado en los repos propios; patrón de
  Cloudflare R2 + Worker con acceso firmado (referencia directa para el
  gating de video de la Cursos nueva); flujo de moderación con roles;
  Cloudflare Turnstile para formularios públicos; ejemplos reales de
  RLS+RPC en Supabase (que es justo lo que falta en los repos propios).
- **Coursia**: solo un esqueleto temprano (TanStack Start). Único rescate:
  `@better-auth-ui/react` (componentes de UI listos para Better Auth).
- **Miaubot**: organizador de archivos multimedia (anime/películas). No
  aplica a ningún proyecto de TEC Emprende — dominio completamente
  distinto. Único uso tangencial posible: patrón de subida por lote con
  Rclone si algún día se necesita respaldo masivo de PDFs/certificados
  fuera de Supabase (no es una necesidad planteada hoy).

---

## Cómo continuar en la próxima sesión

1. Preguntar al usuario si quiere seguir con:
   - RLS de `sbd-ronda3-compras` (archivo listo, solo falta correrlo)
   - Mejoras de `PaginaWebEventos` (quitar self-register + fuga de emails)
   - Arrancar la Fase 0 de la Cursos nueva (repo + esquema + RLS + auth)
   - Las 2 facturas faltantes de Tropibugs en Compras
   - Verificar las 2 cédulas dudosas del grupo "Mujeres ON"
2. Este documento y `ECOSISTEMA.md` deberían bastar para no tener que
   re-explorar los repos desde cero — solo releerlos.
3. Si algo de lo aquí descrito ya cambió (por ejemplo, alguien corrió el
   RLS de Compras, o se agregó SMTP), **actualizar este archivo** en el
   mismo commit que el cambio, para que siga siendo confiable.

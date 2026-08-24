# Roadmap de mejora progresiva

> Fuente principal de verdad para la mejora de `Plataforma-de-Cursos`.
> Última actualización: 2026-08-24.

## Estado operativo actual

**FASES 0, 1, 2 Y 3 COMPLETADAS — FASE 4 EN CURSO.**

Las Fases 2 y 3 fueron integradas en `main` mediante los PR #2 y #3. Las
correcciones de validación posterior de Fase 3 fueron integradas mediante el
PR #4 (`phase/3-validation`), ya mergeado en `main`. Antes de desplegar el
frontend que invoca `bulk_update_participants_with_courses` debe aplicarse la
migración `20260819000000_harden_participant_transactions.sql` en Supabase
remoto.

La Fase 4 se ejecuta en la rama `phase/4-functional-fixes` como un único Pull
Request al cierre, con commits atómicos revisados por el propietario antes de
cada commit. Decisiones previas registradas: se mantiene la aritmética de
vigencia vigente (el día de ingreso cuenta como día 1) corrigiendo solo
documentación; la revocación automática seguirá cambiando únicamente el estado
en cliente, sin escrituras a base de datos durante la carga.

## 1. Objetivo y reglas innegociables

Mejorar progresivamente la arquitectura, mantenibilidad, seguridad, escalabilidad y calidad sin reescribir la aplicación ni alterar innecesariamente su comportamiento observable.

- Flask se mantiene como backend de certificados e integraciones.
- Supabase PostgreSQL y Supabase Auth son la fuente de verdad de datos y autenticación.
- `localStorage` se conserva únicamente como modo explícito de desarrollo; nunca debe activarse silenciosamente en producción.
- Los cambios deben ser pequeños, reversibles, justificados y validados antes de avanzar.
- No se introducirán cambios cosméticos ni funcionalidades nuevas fuera del objetivo técnico de cada fase.
- Una fase no se considera terminada si quedan regresiones conocidas causadas por ella.
- `ROADMAP.md` y `CODEBASE_CONTEXT.md` deben actualizarse cuando cambien el estado, las decisiones o la arquitectura.
- Todo trabajo de implementación se realiza en una rama dedicada y llega a `main` mediante Pull Request; no se trabaja directamente sobre `main`.

## 2. Decisiones arquitectónicas

| ID | Estado | Decisión | Razón |
|---|---|---|---|
| D-001 | Aprobada | Mantener Supabase PostgreSQL/Auth como fuente de verdad. | Preserva el sistema en producción y evita una migración masiva incompatible con el enfoque incremental. |
| D-002 | Aprobada | Mantener Flask para certificados e integraciones. | Es una restricción expresa y ya existe un servicio desplegado y funcional. |
| D-003 | Aprobada | Permitir `localStorage` solo mediante un modo explícito de desarrollo. | Evita que una mala configuración de producción desactive autenticación y cambie silenciosamente la persistencia. |
| D-004 | Aprobada | Proteger progresivamente Flask con la sesión emitida por Supabase. | Unifica la frontera de autenticación sin introducir otro proveedor ni otro almacén de usuarios. |
| D-005 | Aprobada | Caracterizar y probar antes de refactorizar. | Permite distinguir deuda existente de regresiones nuevas. |
| D-006 | Aprobada | Usar ramas de trabajo y Pull Requests hacia `main`. | Mantiene `main` estable y permite exigir validaciones, revisión independiente y confirmación del propietario antes de integrar. |
| D-007 | Aprobada | Semántica de vigencia: la fecha manda — `'expirado'` aplica aunque `p.access` esté apagado; `'sin_acceso'` solo con vigencia viva. Badges y PDF usan la misma precedencia. | La revocación automática apaga `access` en cliente para todos los vencidos; exigir la marca activa haría desaparecer el estado expirado tras cada recarga. Distinguir revocación manual de automática requeriría persistencia nueva y queda como deuda futura si se desea esa UX. |

## 3. Línea base verificada

Fecha de verificación: 2026-08-07.

- Producción frontend: responde HTTP 200 y muestra el login de Supabase sin errores de consola en la carga inicial.
- Backend Render: `/api/health` responde `status=ok`, Cairo disponible e IA configurada.
- `npm run build`: pasa; Vite advierte un chunk principal de aproximadamente 641 kB.
- `npm run lint`: pasa con 0 errores y conserva 14 advertencias conocidas.
- La red actual contiene 51 pruebas Vitest y 104 pruebas pytest. Todavía no hay E2E.
- Las dependencias directas Python están fijadas; `pip check`, `pip-audit` y `npm audit` no reportan vulnerabilidades conocidas en el conjunto actual.
- El working tree ya contenía una modificación ajena en `backend/app.py`: un cambio de indentación en la llamada a `send_file`. Debe preservarse salvo autorización expresa.
- `xlsx` fue reemplazado por ExcelJS cargado bajo demanda y DOMPurify quedó fijado en una versión auditada.
- Las cuatro inserciones SVG pasan por un sanitizador único; Flask valida el contenido antes de transformar, renderizar o almacenar.
- Flask verifica JWT ES256 de Supabase en rutas `POST`, aplica CORS exacto, límites de carga, cuotas por usuario y errores públicos estables.
- La imagen Docker usa usuario no-root, fuentes versionadas y Gunicorn; no descarga recursos durante el arranque.
- Las URLs externas, esquemas locales y CSS ofuscado se rechazan en SVG. La consulta de cédulas conserva únicamente dos hosts constantes y entrada numérica.
- Las migraciones principales habilitan RLS para cursos, etiquetas, participantes y relaciones; la migración de Fase 2 integra también `svg_templates`, Storage y sus políticas.
- Existen workflows de GitHub Actions para ESLint, Semgrep, Trivy y TruffleHog, con resultados SARIF documentados en `docs/CI-PIPELINE.md` y hallazgos en `docs/QA-FINDINGS.md`. Son una capa inicial de auditoría, no una puerta de integración completa: varios análisis continúan aunque encuentren problemas y todavía faltan build y tests.

## 4. Hallazgos priorizados

### Críticos / altos

- SVG almacenado o subido puede llegar sin sanitización a cuatro usos de `dangerouslySetInnerHTML`, creando riesgo de XSS almacenado.
- Endpoints Flask costosos (`generate/batch`, `ai/mapeo`, `cedulas/lookup`) son públicos y no tienen cuotas ni autenticación.
- Las herramientas de exportación y build ya no conservan las vulnerabilidades conocidas que motivaron la Fase 2.
- La sincronización de relaciones participante-curso y participante-etiqueta usa borrar y reinsertar sin transacción; un fallo intermedio puede perder relaciones.

### Medios

- En producción, la ausencia accidental de variables Supabase abre hoy la aplicación sin autenticación y activa persistencia local.
- No hay límites de tamaño para SVG/CSV ni límite seguro de filas de lote.
- Errores internos del backend se devuelven al cliente mediante `str(e)`.
- `TODAY` se calcula al cargar `time.js` y queda congelado si la SPA cruza medianoche.
- La revocación automática inicial usa 45 días y no considera `accessDays` por curso; además solo cambia el estado del cliente.
- La tabla y las políticas de plantillas no están integradas en `supabase/migrations/`.
- Varias mutaciones muestran mensajes de éxito antes de conocer el resultado real.
- Los recordatorios no pasan siempre la lista de cursos a las utilidades de correo.
- Filtros y contadores pueden clasificar como expirado a alguien sin acceso.
- Modo local y Supabase aplican validaciones y retornos diferentes.

### Mantenibilidad

- `backend/app.py` tiene aproximadamente 1.434 líneas y mezcla arranque, proveedores IA, transformación SVG, integraciones externas y rutas HTTP.
- `CertificatesView.jsx` tiene aproximadamente 1.415 líneas y mezcla UI, parsing, red y lógica de certificados.
- Hay detección implícita del tipo de plantilla mediante palabras dentro del SVG.
- Documentos históricos contienen información ya obsoleta o contradictoria sobre persistencia, RLS y alcance del backend.

## 5. Fases de ejecución

Estados: `PENDIENTE`, `EN CURSO`, `BLOQUEADA`, `VALIDANDO`, `COMPLETADA`.

### Fase 0 — Documentación operativa

Estado: **COMPLETADA**

- [x] Inventariar proyecto, documentación, dependencias y despliegues.
- [x] Registrar decisiones D-001 a D-006.
- [x] Crear este roadmap.
- [x] Crear `CODEBASE_CONTEXT.md` como mapa técnico persistente.
- [x] Obtener revisión independiente de ambos documentos.
- [x] Corregir cualquier omisión factual encontrada por la revisión.

Validación de salida:

- Un agente nuevo puede identificar arquitectura, restricciones, estado, riesgos y siguiente tarea leyendo ambos archivos.
- Los documentos no presentan el modo local como fuente válida de producción.

### Fase 1 — Red de seguridad y caracterización

Estado: **COMPLETADA**
Depende de: Fase 0.

- [x] Añadir Vitest con configuración mínima para utilidades JavaScript.
- [x] Añadir pytest y un entorno de dependencias de desarrollo recreable para Flask.
- [x] Caracterizar `time.js`, cédulas, correos y transformaciones determinísticas.
- [x] Caracterizar helpers SVG, resolución de columnas CSV y contratos HTTP Flask.
- [x] Añadir pruebas de caracterización que fallen si se rompen reglas cubiertas de vigencia, cédulas, correo, SVG, CSV o contratos HTTP.
- [x] Corregir los 2 errores actuales de lint sin cambios funcionales colaterales.
- [x] Definir comandos únicos de validación local para frontend y backend.

Validación de salida:

- Build y lint pasan.
- Las suites frontend y backend pasan desde un entorno limpio documentado.
- Las pruebas fallan deliberadamente si se rompe una regla de acceso, mapeo CSV o generación SVG cubierta.
- Revisión independiente confirma que los tests comprueban comportamiento y no implementación accidental.

### Fase 2 — Contención de riesgos de seguridad

Estado: **COMPLETADA**
Depende de: Fase 1.

- [x] Sanitizar SVG antes de cualquier render HTML y probar payloads XSS representativos.
- [x] Validar SVG también en la frontera backend/almacenamiento; definir elementos y atributos permitidos.
- [x] Establecer límites de bytes, filas de lote, formatos y tiempos de espera.
- [x] Sustituir respuestas con detalles internos por errores públicos estables y logging interno.
- [x] Restringir CORS mediante configuración de entorno.
- [x] Añadir rate limiting a endpoints costosos.
- [x] Verificar JWT de Supabase en rutas protegidas y enviar la sesión desde el frontend.
- [x] Añadir encabezados de seguridad compatibles con la UI existente, incluida una CSP probada.
- [x] Sustituir `xlsx` incrementalmente por ExcelJS.
- [x] Revisar y fijar dependencias Python efectivamente utilizadas, incluidos ambos proveedores IA.
- [x] Eliminar la ejecución privilegiada del contenedor y servir Flask con Gunicorn.
- [x] Restringir y validar cualquier URL o recurso remoto aceptado por el backend para contener SSRF.

Validación de salida:

- Ningún payload SVG de la batería de seguridad ejecuta scripts o handlers.
- Solicitudes anónimas a rutas protegidas fallan de manera estable; usuarios autenticados conservan los flujos existentes.
- CORS, límites y rate limiting tienen pruebas automatizadas.
- Generación individual y por lote sigue produciendo archivos válidos.

### Fase 3 — Persistencia coherente y confiable

Estado: **COMPLETADA**
Depende de: Fases 1 y 2.

- [x] Hacer que producción falle de forma segura si Supabase no está configurado.
- [x] Activar `localStorage` solo mediante una bandera explícita y únicamente en desarrollo.
- [x] Mantener la API pública de hooks mientras se separan adaptadores Supabase y desarrollo local.
- [x] Convertir `supabase_setup.sql` en una migración reproducible para `svg_templates`, Storage y RLS (adelantado por la frontera de seguridad de Fase 2).
- [x] Diseñar y aplicar una operación transaccional para relaciones de participantes.
- [x] Uniformar retornos y errores de mutaciones entre adaptadores.
- [x] Añadir estados de carga/error que eviten mensajes de éxito falsos.
- [x] Verificar desde cero migraciones + seed en Supabase local antes de usar cambios remotos.

Validación de salida:

- Cada ejecución utiliza exactamente un adaptador de persistencia explícito.
- Ningún build de producción puede entrar en modo local por omisión.
- El esquema completo se reconstruye solamente con migraciones versionadas.
- Fallos simulados de relaciones no eliminan inscripciones existentes.

### Fase 4 — Corrección funcional respaldada por pruebas

Estado: **EN CURSO** (rama `phase/4-functional-fixes`)
Depende de: Fases 1 y 3.

Regla de vigencia confirmada por el propietario (2026-08-24): la aritmética
actual es correcta — el día de ingreso cuenta como día 1 y `daysElapsed` mide
días completos transcurridos; solo se corregirá documentación y comentarios.

- [x] Calcular la fecha actual en tiempo de llamada, no al importar el módulo.
- [x] Unificar la vigencia por curso en carga, filtros, recordatorios, exportaciones y revocación.
- [x] Corregir clasificación de participantes sin acceso.
- [x] Pasar cursos a todas las utilidades de recordatorios.
- [x] Validar correo, teléfono, cédula, nombres de etiquetas y duplicados de forma equivalente.
- [x] Corregir la vista previa de exportación en los breakpoints actuales.
- [x] Verificar los hallazgos existentes de `docs/checkGeneral.md` y cerrar solo los reproducidos y corregidos.

Validación de salida:

- Cada defecto tiene prueba de regresión automatizada y comprobación del flujo visible afectado.
- Dashboard, participantes, cursos, accesos, recordatorios, importación y exportación conservan sus contratos.

### Fase 5 — Separación incremental de responsabilidades

Estado: **PENDIENTE**
Depende de: Fases 1 a 4.

- [ ] Extraer configuración y creación de la app Flask sin cambiar rutas.
- [ ] Extraer servicios determinísticos de SVG, CSV, IA y consulta de cédulas en pasos pequeños.
- [ ] Dividir `CertificatesView.jsx` por pestaña y responsabilidad, preservando props y comportamiento.
- [ ] Centralizar cliente HTTP de certificados, autenticación y manejo de errores.
- [ ] Reemplazar detección frágil de plantilla por metadata explícita mediante migración compatible.

Validación de salida:

- Cada extracción mantiene pruebas y contratos HTTP verdes.
- No hay migración de framework ni reescritura masiva.

### Fase 6 — Consolidación de CI, rendimiento y operación

Estado: **PENDIENTE**
Depende de: fases anteriores necesarias.

- [ ] Partir de los workflows existentes de ESLint, Semgrep, Trivy y TruffleHog; depurar su configuración y conservar reportes SARIF útiles.
- [ ] Convertir CI en una puerta reproducible sin secretos ni acceso a producción: lint, build, tests y build de Docker deben bloquear el PR cuando fallen.
- [ ] Configurar protección de `main`: sin pushes directos, Pull Request obligatorio y checks requeridos antes del merge.
- [ ] Añadir pruebas E2E de caminos felices y casos límite con un entorno aislado.
- [ ] Medir y reducir el chunk principal mediante carga diferida donde sea justificable.
- [ ] Sustituir instalación de fuentes en runtime por artefactos reproducibles de imagen/repositorio.
- [ ] Añadir observabilidad sin registrar PII ni secretos.

Validación de salida:

- Un cambio no integrable queda bloqueado por controles reproducibles.
- Las pruebas E2E no escriben en producción.
- Arranque y generación del backend son reproducibles sin descargas de fuentes en runtime.

## 6. Registro de validaciones y avances

| Fecha | Fase | Validación | Resultado |
|---|---|---|---|
| 2026-08-07 | Diagnóstico | `npm run build` | Pasa con advertencia de chunk grande. |
| 2026-08-07 | Diagnóstico | `npm run lint` | Falla: 2 errores, 17 advertencias. |
| 2026-08-07 | Diagnóstico | Producción frontend, carga del login | HTTP 200, login visible, sin errores de consola en carga inicial. |
| 2026-08-07 | Diagnóstico | Backend `/api/health` y `/api/templates` | HTTP 200; Cairo e IA disponibles; 3 SVG listados. |
| 2026-08-07 | Diagnóstico | AST de `backend/app.py` | Sintaxis Python válida. |
| 2026-08-07 | Diagnóstico | Dependencias Python locales | Flask no está instalado en el intérprete global. |
| 2026-08-07 | Diagnóstico | Auditoría npm de producción | 1 vulnerabilidad alta y 1 dependencia transitiva moderada afectada. |
| 2026-08-07 | Diagnóstico | Revisión independiente Sonnet (3 focos) | Confirma riesgos SVG, APIs públicas, persistencia dual, ausencia de tests y monolitos. |
| 2026-08-07 | Fase 0 | Revisión independiente de roadmap y contexto | Se corrigieron referencias obsoletas de `CLAUDE.md`, el rewrite inactivo de Vercel y el mapa de hooks. |
| 2026-08-12 | Fase 0 | Auditoría de los 8 commits de Ximena incorporados en `origin/main` | No cambian arquitectura ni código funcional; añaden CI de auditoría, documentación QA y eliminan la propuesta obsoleta `NOTES.MD`. |
| 2026-08-12 | Fase 0 | Revisión independiente de commits y documentos QA/CI | Confirma que los workflows son parcialmente no bloqueantes y que deben integrarse al plan, no reemplazar las fases de pruebas y seguridad. |
| 2026-08-12 | Higiene local | Limpieza del entorno Python accidental | `.venv/` (4.158 archivos) se movió a la Papelera y se añadieron exclusiones Python a `.gitignore`. |
| 2026-08-12 | Fase 1 | `npm test` | 3 archivos y 19 pruebas Vitest pasan. |
| 2026-08-12 | Fase 1 | `python -m pytest` desde `backend/` | 17 pruebas pasan; Cairo/IA/red/servicios externos quedan aislados mediante dobles. |
| 2026-08-12 | Fase 1 | `npm run lint` | Pasa con 0 errores; permanecen 17 advertencias de línea base. |
| 2026-08-12 | Fase 1 | `npm run build` | Pasa; permanece advertencia por chunk principal de 640,83 kB. |
| 2026-08-12 | Fase 1 | Revisiones independientes frontend y backend | Ambas puertas aprobadas; se corrigió el aislamiento de Cairo en Windows y una aserción SVG acoplada a serialización. |
| 2026-08-12 | Fase 2 | `npm test`, lint, build y `npm audit` | 41 pruebas pasan; lint conserva 16 advertencias conocidas y 0 errores; Vite 8 compila; auditoría completa reporta 0 vulnerabilidades. |
| 2026-08-12 | Fase 2 | `pytest`, `pip check` y `pip-audit` | 101 pruebas pasan; dependencias coherentes y 0 vulnerabilidades conocidas. |
| 2026-08-12 | Fase 2 | Smoke Linux de CairoSVG | Generación HTTP individual PDF y lote de 2 PNG dentro de ZIP válidos. |
| 2026-08-12 | Fase 2 | Smoke Linux de Gunicorn | Worker inicia, `/api/health` responde 200 y reporta Cairo disponible. |
| 2026-08-12 | Fase 2 | Revisión independiente adversarial | Encontró y se corrigieron CSS ofuscado, recursos en `image-set`/`cross-fade`, orden auth/cuotas y escritura directa a Storage. |
| 2026-08-17 | Fase 3 | Aplicación del patrón Adapter en hooks | Completada la separación de persistencia en `useAuth`, `useCourses`, `useParticipants`, `useTags` y `useTemplates`, permitiendo seleccionar entre `localStorage` y Supabase mediante `VITE_STORAGE_MODE` sin cambiar la API pública de los hooks. |
| 2026-08-17 | Fase 3 | Revisión de producción sin Supabase configurado | Producción queda protegida frente a una configuración incompleta de Supabase; el modo `localStorage` no se activa implícitamente. |
| 2026-08-17 | Fase 3 | Bandera explícita para `localStorage` | `localStorage` queda restringido al modo `local` explícito y al entorno de desarrollo, evitando fallback silencioso desde producción. |
| 2026-08-18 | Fase 3 | Operación transaccional de participantes y relaciones | Completada la operación transaccional para creación y actualización de participantes junto con sus cursos y etiquetas mediante funciones RPC de Supabase. |
| 2026-08-18 | Fase 3 | Contrato uniforme entre adapters | Normalizados los retornos de éxito y error de los adapters locales y Supabase: entidades en operaciones con entidad, `{ id, deleted: true }` en eliminaciones y `{ error: { message, code } }` ante errores. |
| 2026-08-18 | Fase 3 | Estados de carga y error en hooks | Añadidos estados independientes de carga/error para operaciones de autenticación, cursos, participantes, etiquetas y plantillas, evitando representar operaciones fallidas como éxitos. |
| 2026-08-18 | Fase 3 | Verificación de migraciones y seed en Supabase local | Migraciones y datos iniciales fueron verificados desde cero en Supabase local antes de considerar cambios remotos, incluyendo tablas, relaciones, RLS, Storage y plantillas SVG. |
| 2026-08-19 | Fase 3 | Validación posterior al merge | Se corrigió el contrato de seguridad de plantillas tras moverlo al adapter, se añadieron pruebas de configuración/adapters y las suites pasan con 51 pruebas Vitest y 104 pytest. |
| 2026-08-19 | Fase 3 | Mutaciones visibles | Formularios, confirmaciones, importación y acciones CRUD esperan el resultado persistente y solo cierran o anuncian éxito cuando la operación termina correctamente. |
| 2026-08-19 | Fase 3 | Transacción masiva y permisos RPC | La migración `20260819000000_harden_participant_transactions.sql` restringe ejecución a `authenticated`, endurece `search_path`, rechaza participantes inexistentes y vuelve atómica la actualización masiva de campos + cursos. |
| 2026-08-19 | Fase 3 | Supabase local desde cero | `supabase start` aplicó todas las migraciones y `seed.sql`; una prueba con FK inválida confirmó rollback de pago/acceso y permisos `anon=false`, `authenticated=true`. |
| 2026-08-19 | Fase 3 | Revisión independiente Claude Code/Sonnet | Dos subagentes detectaron el test desactualizado, la actualización masiva no atómica y la divergencia de `toggleActive`; los tres hallazgos fueron corregidos con cobertura. |
| 2026-08-24 | Integración | Merge del PR #4 (`phase/3-validation`) en `main` | `main` actualizado y limpio; las correcciones de validación de Fase 3 quedan integradas. |
| 2026-08-24 | Fase 4 | Línea base local en rama `phase/4-functional-fixes` | `npm run lint` pasa (0 errores, 14 advertencias); `npm test` pasa (51 pruebas Vitest, 10 archivos); `npm run build` pasa con advertencia de chunks grandes (App ~705 kB; ExcelJS diferido). `pytest` no ejecutable: `.venv` no existe localmente y debe recrearse desde `requirements-dev.txt` antes de validar backend. |
| 2026-08-24 | Fase 4 | Fecha en tiempo de llamada y vigencia unificada (commits 2-3) | `TODAY` congelado eliminado; `classifyAccess` canónico adoptado por AccessView, Dashboard, Sidebar, ParticipantsView, Charts y pdf; revocación automática usa días por curso solo en cliente; correo calcula fechas con el curso real; duplicaciones de `getAccessDays` y literales 45 eliminadas. Suites: 55 pruebas Vitest, lint 0 errores/14 advertencias, build OK. |
| 2026-08-24 | Fase 4 | Cursos en recordatorios (commit 4) | `RemindersView`, `AccessView` y `ProfileView` pasan `courses` a `buildReminderEmail`, `openEmailClient` y `copyEmailToClipboard`; los correos ya no muestran UUID de curso ni fechas con 45 días genéricos. La prueba automatizada del correo vive en `email.test.js`; el cableado de vistas se verifica por flujo visible. |
| 2026-08-24 | Fase 4 | Validaciones equivalentes entre modos (commit 5) | Nuevo `utils/validators.js` (correo, teléfono, cédula, duplicados de correo y etiquetas) adoptado por `ImportView`, `ParticipantModal` (formato + duplicado con errores inline), `TagsView` (trim y duplicados insensibles a mayúsculas) y ambos adapters de etiquetas; el adapter local de participantes ahora normaliza cédula y trima texto igual que Supabase. El chequeo de correo duplicado queda en la capa compartida de UI, no en adapters. Suites: 78 pruebas Vitest (13 archivos), lint 0 errores/14 advertencias, build OK. |
| 2026-08-24 | Fase 4 | Vista previa de exportación y cierre de checkGeneral (commit 6) | La tabla de vista previa usa `colgroup` con anchos fijos y la clase `tpreview` (`overflow-wrap:anywhere`) para que correo y cursos largos se envuelvan sin invadir columnas, en escritorio y en todos los breakpoints. La celda de cursos de la tabla de participantes dejó de truncar con puntos suspensivos y ahora continúa hacia abajo con la misma estrategia. Los seis hallazgos de `docs/checkGeneral.md` se reprodujeron antes y se verificó su corrección después: cinco ya resueltos por los commits 2-5 y este último en commit 6; el documento registra el estado final por hallazgo. Suites: 78 pruebas Vitest, lint 0 errores/14 advertencias, build OK. |
| 2026-08-24 | Fase 4 | Alineación de insignia y PDF con la semántica canónica (commit 7) | Revisión previa al PR detectó que `TimerBadge` y el listado completo del PDF evaluaban `!access` antes que la fecha, contradiciendo a listas y métricas para un vencido con marca apagada. Ambos usan ahora la precedencia de `classifyAccess` (fecha manda, decisión D-007); se corrigió además una redacción errónea del cierre del hallazgo 2 en `docs/checkGeneral.md`. Suites: 78 pruebas Vitest, lint 0 errores/14 advertencias, build OK. |

## 7. Problemas y cambios respecto al plan

- La documentación histórica afirmaba que RLS no existía, pero la migración inicial actual sí lo habilita para cinco tablas. Esa afirmación histórica se considera obsoleta.
- `NOTES.MD` proponía abandonar Supabase. El usuario resolvió la contradicción el 2026-08-07: se mantiene Supabase.
- Las revisiones independientes sugirieron sanitización con DOMPurify, pero la versión transitiva actual también está afectada por avisos de seguridad. La solución final debe fijar una versión segura y probar su configuración; no se adoptará ciegamente una dependencia vulnerable.
- El 2026-08-07 se alcanzó a iniciar la preparación local de Fase 1, pero el usuario aclaró que por ahora solo quería el roadmap estructurado. Los cambios de código, pruebas, scripts y dependencias de esa preparación fueron revertidos. El directorio local `.venv/` que había quedado incompleto fue retirado de forma recuperable el 2026-08-12 y ahora está ignorado por Git.
- El 2026-08-11 `origin/main` recibió una capa inicial de análisis automático: ESLint, Semgrep, Trivy y TruffleHog con SARIF, además de `docs/CI-PIPELINE.md` y `docs/QA-FINDINGS.md`. No se considera completada la Fase 6 porque no ejecuta build/tests y varios hallazgos solo se reportan. `ci-setup/eslint.config.js` no es la configuración activa del proyecto y deberá evaluarse antes de conservarlo a largo plazo.
- `docs/QA-FINDINGS.md` es una instantánea útil, no una fuente infalible: sus referencias de línea pueden quedar obsoletas y cualquier hallazgo debe confirmarse contra el código y las versiones vigentes antes de corregirlo.
- El flujo obligatorio para futuras fases es: rama dedicada → validaciones locales aplicables, documentando la línea base preexistente → Pull Request a `main` → checks remotos requeridos → revisión por al menos un subagente independiente adecuado (Claude/Sonnet si está disponible) → correcciones → confirmación del propietario → merge. Para integrar, los checks requeridos deben estar verdes y no puede haber regresiones nuevas; la protección efectiva de `main` deberá configurarse en GitHub.
- La revisión externa con Claude Code se intentó explícitamente con `--model sonnet`; la invocación con lectura directa agotó el tiempo disponible. La puerta de Fase 1 se apoyó por ello en dos revisores independientes internos, uno por frontend y otro por backend. Nunca se utilizó Opus.
- El comentario de `time.js` afirma que el día de ingreso cuenta como día 1, mientras `daysElapsed` lo representa como 0 días transcurridos. La suite conserva el comportamiento real; aclarar la regla antes de cambiarla en Fase 4.
- `ProfileView` ya cumple Rules of Hooks, pero `selectedTags` continúa siendo estado inicial y no se resincroniza si una misma instancia cambia de participante. Es deuda preexistente no ampliada por Fase 1.
- La revisión externa con Claude Sonnet volvió a intentarse en Fase 2 en modo de solo lectura y agotó el tiempo sin producir hallazgos. La revisión adversarial interna sí completó varias rondas y sus cuatro bloqueos reproducibles fueron corregidos con pruebas.
- Docker Desktop no estaba activo, por lo que no se ejecutó un `docker build` real. El contrato del Dockerfile tiene pruebas estáticas y el mismo stack se validó en Linux/WSL con CairoSVG y Gunicorn; el build de imagen permanece como check obligatorio del Pull Request.
- La migración `20260812000000_secure_svg_templates.sql` debe aplicarse junto con el despliegue backend. Antes de desplegar, Render necesita `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ALLOWED_ORIGINS` y `RATELIMIT_STORAGE_URI`; nunca exponer la service role al frontend.
- La validación posterior al merge de Fase 3 encontró que los hooks devolvían errores correctamente, pero varios callers todavía cerraban diálogos o mostraban éxito sin esperar la promesa. La corrección conserva los adapters de Ximena y hace que la UI respete su contrato.
- `20260819000000_harden_participant_transactions.sql` debe aplicarse antes de desplegar el frontend que usa `bulk_update_participants_with_courses`; no modificar ni reescribir la migración original ya integrada.

## 8. Siguiente paso ejecutable

Ejecutar los commits de la Fase 4 en `phase/4-functional-fixes`, revisados por
el propietario antes de cada commit, en este orden: (1) fecha en tiempo de
llamada; (2) vigencia unificada por curso y clasificación de participantes sin
acceso; (3) cursos en utilidades de recordatorio; (4) validaciones equivalentes
local/Supabase; (5) vista previa de exportación y cierre de hallazgos de
`docs/checkGeneral.md`. Al cierre: abrir un único Pull Request con lint, tests
y build verdes, revisión independiente y confirmación del propietario. La
migración `20260819000000_harden_participant_transactions.sql` debe aplicarse
en Supabase remoto antes de desplegar el frontend resultante.

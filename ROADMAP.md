# Roadmap de mejora progresiva

> Fuente principal de verdad para la mejora de `Plataforma-de-Cursos`.
> Última actualización: 2026-08-12.

## Estado operativo actual

**PLANIFICACIÓN COMPLETADA — EJECUCIÓN EN PAUSA POR INDICACIÓN DEL PROPIETARIO.**

No debe iniciarse ninguna fase de implementación hasta que el usuario lo indique explícitamente. Cuando autorice el inicio o diga “reanuda el trabajo”, se debe comenzar por la Fase 1, no por la Fase 2 ni por refactors estructurales.

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

## 3. Línea base verificada

Fecha de verificación: 2026-08-07.

- Producción frontend: responde HTTP 200 y muestra el login de Supabase sin errores de consola en la carga inicial.
- Backend Render: `/api/health` responde `status=ok`, Cairo disponible e IA configurada.
- `npm run build`: pasa; Vite advierte un chunk principal de aproximadamente 641 kB.
- `npm run lint`: falla con 2 errores de reglas de Hooks y 17 advertencias.
- No hay archivos de pruebas unitarias, de integración ni E2E.
- El Python global disponible no tiene Flask instalado; no constituye todavía un entorno reproducible del backend.
- El working tree ya contenía una modificación ajena en `backend/app.py`: un cambio de indentación en la llamada a `send_file`. Debe preservarse salvo autorización expresa.
- `npm audit --omit=dev` reporta una vulnerabilidad alta en `xlsx` y vulnerabilidades transitivas en `dompurify`.
- La aplicación renderiza SVG no confiable mediante `dangerouslySetInnerHTML` sin sanitización.
- Flask carece actualmente de autenticación, límites de carga y rate limiting; CORS acepta orígenes arbitrarios.
- La imagen Docker ejecuta el backend como `root` y arranca Flask mediante `app.run()` en lugar de un servidor WSGI de producción.
- El procesamiento de URLs dinámicas y contenido remoto debe revisarse contra SSRF antes de aceptar entradas no confiables.
- Las versiones fijadas de Pillow, lxml, CairoSVG, Flask y flask-cors fueron señaladas por Trivy y deben revalidarse; si los avisos siguen vigentes, se actualizarán de forma controlada y con pruebas de regresión.
- Las migraciones principales sí habilitan RLS para cursos, etiquetas, participantes y tablas de relación. La tabla `svg_templates` y su bucket se crean fuera del flujo formal de migraciones en `supabase_setup.sql`.
- Existen workflows de GitHub Actions para ESLint, Semgrep, Trivy y TruffleHog, con resultados SARIF documentados en `docs/CI-PIPELINE.md` y hallazgos en `docs/QA-FINDINGS.md`. Son una capa inicial de auditoría, no una puerta de integración completa: varios análisis continúan aunque encuentren problemas y todavía faltan build y tests.

## 4. Hallazgos priorizados

### Críticos / altos

- SVG almacenado o subido puede llegar sin sanitización a cuatro usos de `dangerouslySetInnerHTML`, creando riesgo de XSS almacenado.
- Endpoints Flask costosos (`generate/batch`, `ai/mapeo`, `cedulas/lookup`) son públicos y no tienen cuotas ni autenticación.
- `xlsx@0.18.5` presenta vulnerabilidades conocidas sin corrección disponible en el paquete actual del registro npm.
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

Estado: **PENDIENTE — NO INICIAR SIN INDICACIÓN DEL USUARIO**
Depende de: Fase 0.

- [ ] Añadir Vitest con configuración mínima para utilidades JavaScript.
- [ ] Añadir pytest y un entorno de dependencias de desarrollo reproducible para Flask.
- [ ] Caracterizar `time.js`, cédulas, correos y transformaciones determinísticas.
- [ ] Caracterizar helpers SVG, resolución de columnas CSV y contratos HTTP Flask.
- [ ] Añadir pruebas de los defectos confirmados como regresiones esperadas antes de corregirlos.
- [ ] Corregir los 2 errores actuales de lint sin cambios funcionales colaterales.
- [ ] Definir comandos únicos de validación local para frontend y backend.

Validación de salida:

- Build y lint pasan.
- Las suites frontend y backend pasan desde un entorno limpio documentado.
- Las pruebas fallan deliberadamente si se rompe una regla de acceso, mapeo CSV o generación SVG cubierta.
- Revisión independiente confirma que los tests comprueban comportamiento y no implementación accidental.

### Fase 2 — Contención de riesgos de seguridad

Estado: **PENDIENTE**
Depende de: Fase 1.

- [ ] Sanitizar SVG antes de cualquier render HTML y probar payloads XSS representativos.
- [ ] Validar SVG también en la frontera backend/almacenamiento; definir elementos y atributos permitidos.
- [ ] Establecer límites de bytes, filas de lote, formatos y tiempos de espera.
- [ ] Sustituir respuestas con detalles internos por errores públicos estables y logging interno.
- [ ] Restringir CORS mediante configuración de entorno.
- [ ] Añadir rate limiting a endpoints costosos.
- [ ] Verificar JWT de Supabase en rutas protegidas y enviar la sesión desde el frontend.
- [ ] Añadir encabezados de seguridad compatibles con la UI existente, incluida una CSP probada.
- [ ] Resolver `xlsx`: actualización segura si existe una distribución mantenida o sustitución incremental de la exportación.
- [ ] Revisar y fijar dependencias Python efectivamente utilizadas, incluido el proveedor IA.
- [ ] Eliminar la ejecución privilegiada del contenedor y servir Flask con un WSGI de producción.
- [ ] Restringir y validar cualquier URL o recurso remoto aceptado por el backend para contener SSRF.

Validación de salida:

- Ningún payload SVG de la batería de seguridad ejecuta scripts o handlers.
- Solicitudes anónimas a rutas protegidas fallan de manera estable; usuarios autenticados conservan los flujos existentes.
- CORS, límites y rate limiting tienen pruebas automatizadas.
- Generación individual y por lote sigue produciendo archivos válidos.

### Fase 3 — Persistencia coherente y confiable

Estado: **PENDIENTE**
Depende de: Fases 1 y 2.

- [ ] Hacer que producción falle de forma segura si Supabase no está configurado.
- [ ] Activar `localStorage` solo mediante una bandera explícita y únicamente en desarrollo.
- [ ] Mantener la API pública de hooks mientras se separan adaptadores Supabase y desarrollo local.
- [ ] Convertir `supabase_setup.sql` en migraciones reproducibles para `svg_templates`, Storage y RLS.
- [ ] Diseñar y aplicar una operación transaccional para relaciones de participantes.
- [ ] Uniformar retornos y errores de mutaciones entre adaptadores.
- [ ] Añadir estados de carga/error que eviten mensajes de éxito falsos.
- [ ] Verificar desde cero migraciones + seed en Supabase local antes de usar cambios remotos.

Validación de salida:

- Cada ejecución utiliza exactamente un adaptador de persistencia explícito.
- Ningún build de producción puede entrar en modo local por omisión.
- El esquema completo se reconstruye solamente con migraciones versionadas.
- Fallos simulados de relaciones no eliminan inscripciones existentes.

### Fase 4 — Corrección funcional respaldada por pruebas

Estado: **PENDIENTE**
Depende de: Fases 1 y 3.

- [ ] Calcular la fecha actual en tiempo de llamada, no al importar el módulo.
- [ ] Unificar la vigencia por curso en carga, filtros, recordatorios, exportaciones y revocación.
- [ ] Corregir clasificación de participantes sin acceso.
- [ ] Pasar cursos a todas las utilidades de recordatorios.
- [ ] Validar correo, teléfono, cédula, nombres de etiquetas y duplicados de forma equivalente.
- [ ] Corregir la vista previa de exportación en los breakpoints actuales.
- [ ] Verificar los hallazgos existentes de `docs/checkGeneral.md` y cerrar solo los reproducidos y corregidos.

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

## 7. Problemas y cambios respecto al plan

- La documentación histórica afirmaba que RLS no existía, pero la migración inicial actual sí lo habilita para cinco tablas. Esa afirmación histórica se considera obsoleta.
- `NOTES.MD` proponía abandonar Supabase. El usuario resolvió la contradicción el 2026-08-07: se mantiene Supabase.
- Las revisiones independientes sugirieron sanitización con DOMPurify, pero la versión transitiva actual también está afectada por avisos de seguridad. La solución final debe fijar una versión segura y probar su configuración; no se adoptará ciegamente una dependencia vulnerable.
- El 2026-08-07 se alcanzó a iniciar la preparación local de Fase 1, pero el usuario aclaró que por ahora solo quería el roadmap estructurado. Los cambios de código, pruebas, scripts y dependencias de esa preparación fueron revertidos. El directorio local `.venv/` que había quedado incompleto fue retirado de forma recuperable el 2026-08-12 y ahora está ignorado por Git.
- El 2026-08-11 `origin/main` recibió una capa inicial de análisis automático: ESLint, Semgrep, Trivy y TruffleHog con SARIF, además de `docs/CI-PIPELINE.md` y `docs/QA-FINDINGS.md`. No se considera completada la Fase 6 porque no ejecuta build/tests y varios hallazgos solo se reportan. `ci-setup/eslint.config.js` no es la configuración activa del proyecto y deberá evaluarse antes de conservarlo a largo plazo.
- `docs/QA-FINDINGS.md` es una instantánea útil, no una fuente infalible: sus referencias de línea pueden quedar obsoletas y cualquier hallazgo debe confirmarse contra el código y las versiones vigentes antes de corregirlo.
- El flujo obligatorio para futuras fases es: rama dedicada → validaciones locales aplicables, documentando la línea base preexistente → Pull Request a `main` → checks remotos requeridos → revisión por al menos un subagente independiente adecuado (Claude/Sonnet si está disponible) → correcciones → confirmación del propietario → merge. Para integrar, los checks requeridos deben estar verdes y no puede haber regresiones nuevas; la protección efectiva de `main` deberá configurarse en GitHub.

## 8. Siguiente paso ejecutable

Esperar una indicación explícita del usuario. Cuando llegue, crear o reutilizar una rama dedicada desde `main` actualizado y comenzar la Fase 1 con el arnés mínimo de Vitest y pytest. Antes del Pull Request, ejecutar las validaciones locales aplicables y documentar cualquier fallo preexistente; después, atender checks remotos y revisión independiente. No integrar con checks requeridos fallidos, regresiones nuevas o sin confirmación del propietario. No iniciar refactors estructurales ni cambios de persistencia antes de contar con pruebas de caracterización.

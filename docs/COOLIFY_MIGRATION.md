# Migración a Coolify — TEC Emprende Lab

> Guía base: `Guia_Estandar_Deploy_Coolify_TEC_Emprende_Lab.pdf` (v1.0, 19 oct 2026)
> Guía de acceso: `Guia_Conexion_Contabo.pdf` (v1.0, 19 oct 2026)
> Estado: **EN PROGRESO — 7.1 Inventario local** | Última actualización: 2026-10-23

## 1. Objetivo

Migrar el despliegue actual (SPA en Vercel + Flask en Render) hacia Coolify v4
sobre el VPS Contabo (Ubuntu 24.04.5 LTS), manteniendo rollback a Vercel/Render
hasta completar el corte con validación. La migración no debe copiar
contenedores manualmente: cada servicio debe reconstruirse desde GitHub.

## 2. Inventario de origen (7.1)

### 2.1 Repositorio

| Dato | Valor |
|---|---|
| Repo | `Plataforma-de-Cursos` (`github.com/TEC-Emprende-Lab/Plataforma-de-Cursos`) |
| Rama local | `main` |
| HEAD local | `1f35152` — Merge PR #7 de `phase/5-flask-structure` |
| Remoto | `origin/main` sincronizado al inicio de esta auditoría |
| Working tree | `ROADMAP.md`, `docs/COOLIFY_MIGRATION.md`, `src/config.js`, `.env.example` y artefactos Docker nuevos; PDFs de guías sin versionar |
| Node | `v24.19.0`; `package.json` exige `^20.19.0 || >=22.12.0` |
| Python local | `.venv` creado con Python 3.14.7; pytest ejecutable |
| Docker local | Cliente disponible y `compose.yaml` validado; daemon Docker Desktop **no está corriendo**, por lo que falta construir y levantar la pila |
| `node_modules` | Instalado con `npm ci`; lint, tests y build ejecutables |
| Stack local | `compose.yaml` con PostgreSQL 17, Redis 7, backend Flask y frontend Nginx |

### 2.2 Frontend (SPA)

| Dato | Valor |
|---|---|
| Stack | React 18.3.1 + Vite 8.2.1 |
| Build | `npm run build` → `dist/` |
| Hosting actual | Vercel (`plataforma-de-cursos-zeta.vercel.app`) |
| Backend usado | Flask en Render vía URL absoluta |
| Entry | `index.html` → `src/main.jsx` → `src/App.jsx` |

Hallazgos:

- `src/config.js` usa `VITE_CERT_API_URL` y conserva Render solo como fallback.
  Esa constante se usa en `src/components/CertificatesView.jsx` y
  `src/adapters/supabase/templatesAdapter.js` (analyze, templates, preview,
  generate, batch, health, AI status).
- Ya existen `Dockerfile` raíz (build Vite + Nginx), `nginx.conf` y
  `.dockerignore` raíz para construir la SPA como contenedor.
- `compose.yaml` define la pila local completa: PostgreSQL 17, Redis 7, backend
  Flask y frontend Nginx. La topología de producción seguirá siendo Vercel/Render
  hasta el corte a Coolify.
- `vercel.json` conserva un rewrite `/api/*` sin carpeta `api/` y cabeceras CORS
  con `Access-Control-Allow-Origin: *` para `/api/*`. Es configuración heredada;
  las llamadas reales usan la URL absoluta de Render.
- Las variables `VITE_*` se incrustan en el bundle durante el build. No deben
  contener secretos; `VITE_SUPABASE_ANON_KEY` es pública por diseño.

### 2.3 Backend (Flask)

| Dato | Valor |
|---|---|
| Stack | Flask 3.1.3, Gunicorn 26.0.0, Python 3.11.15-slim-bookworm |
| Entry | `app:app` con `backend/gunicorn.conf.py` |
| Puerto interno | `5050` (`PORT` configurable) |
| Hosting actual | Render |
| Healthcheck | `GET /api/health` (Dockerfile incluido) |
| Usuario | No-root (`app`, UID 10001) |
| Fuentes | Versionadas en `backend/fonts/`; la imagen no descarga recursos |
| Persistencia local | No identificada; plantillas se guardan en Supabase Storage |

Hallazgos:

- `backend/Dockerfile` ya cumple lo esencial de la guía: usuario no-root,
  Gunicorn, healthcheck HTTP, fuentes locales, escucha en `0.0.0.0` por
  `gunicorn.conf.py`, logs a stdout/stderr y `SIGTERM` gestionado por Gunicorn.
- `backend/.dockerignore` ya excluye cachés, `.env`, tests, `.git`, CSV, ZIP,
  `*.dump`, `*.sql` y `backups/`.
- En producción `AppConfig.from_env()` exige `SUPABASE_SERVICE_ROLE_KEY`,
  `CORS_ALLOWED_ORIGINS` (HTTPS, sin `*`) y `RATELIMIT_STORAGE_URI` con esquema
  `redis`/`rediss`. `AuthConfig` exige `SUPABASE_URL` y `AUTH_MODE`.
- El rate limiting distribuido requiere Redis real. `compose.yaml` ya provisiona
  Redis 7 para local; en Coolify debe crearse el servicio interno equivalente.
- Los workers/threads de Gunicorn usan valores por defecto (1 worker, 2 threads)
  salvo que se configuren por entorno. Falta medir CPU/RAM reales en el VPS.

### 2.4 Base de datos, Storage y respaldos

| Dato | Valor |
|---|---|
| DB actual | Supabase PostgreSQL gestionado (`qhmynvpgmrupqzojcvua.supabase.co`) |
| DB destino | PostgreSQL 17 en Coolify, volumen persistente, puerto 5432 interno |
| DB local | PostgreSQL 17 en `compose.yaml`, puerto `127.0.0.1:5432` |
| Auth/Storage | Supabase gestionado; topología destino pendiente (D-013) |
| Migraciones locales | 11 archivos en `supabase/migrations/` |
| Últimas migraciones | `20260812000000_secure_svg_templates.sql`, `20260818000000_transactional_participants.sql`, `20260819000000_harden_participant_transactions.sql` |
| Persistencia de app | PostgreSQL + Storage en Supabase; destino PostgreSQL con volumen en Coolify |
| Respaldos | No hay scripts ni procedimiento de backup/restore documentado en el repo |

Pendientes:

- No se puede verificar desde local si las migraciones están aplicadas en
  Supabase remoto. Antes de desplegar el frontend que usa
  `bulk_update_participants_with_courses` debe aplicarse
  `20260819000000_harden_participant_transactions.sql`.
- `20260812000000_secure_svg_templates.sql` debe estar aplicada para el flujo de
  plantillas Storage/RLS.
- Las migraciones usan roles de Supabase (`authenticated`, `anon`) y el esquema
  `storage`; un PostgreSQL limpio no las acepta sin preparar esos objetos. El
  camino previsto es restaurar un dump completo, no ejecutar las migraciones
  desde cero sobre Postgres plano.
- Definir RPO/RTO, tomar respaldo consistente de Supabase (DB + Storage) y
  ensayar restauración antes del corte.

### 2.5 Variables y secretos

`.env.example` ya separa frontend y backend, incluye `VITE_CERT_API_URL` y
documenta la conexión a PostgreSQL. `compose.yaml` usa valores por defecto
locales para poder arrancar sin secretos; para paridad con Coolify hay que usar
`APP_ENV=production` y cargar los secretos reales.

| Variable | Consumidor | Momento | Secreto |
|---|---|---|---|
| `VITE_STORAGE_MODE` | SPA | build | No |
| `VITE_SUPABASE_URL` | SPA | build | No |
| `VITE_SUPABASE_ANON_KEY` | SPA | build | No (pública) |
| `VITE_DIAGNOSTICO_API_URL` | SPA | build | No |
| URL de Flask (`CERT_API`) | SPA | build (hoy hardcode) | No |
| `APP_ENV` | Flask | runtime | No |
| `AUTH_MODE` | Flask | runtime | No |
| `SUPABASE_URL` | Flask | runtime | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Flask | runtime | **Sí** |
| `CORS_ALLOWED_ORIGINS` | Flask | runtime | No |
| `RATELIMIT_STORAGE_URI` | Flask | runtime | **Sí** (incluye credenciales) |
| `MAX_REQUEST_BYTES`, `MAX_SVG_BYTES`, `MAX_CSV_BYTES` | Flask | runtime | No |
| `MAX_BATCH_ROWS`, `MAX_CEDULAS` | Flask | runtime | No |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | Flask | runtime | **Sí** |
| `PORT`, `GUNICORN_*` | Flask | runtime | No |

Reglas:

- Los secretos van en Coolify → Environment Variables, nunca en Git, imagen o
  logs. La service role no lleva prefijo `VITE_`.
- `VITE_*` queda visible en el navegador; no introducir secretos ahí.
- Al migrar, separar el ejemplo de frontend y backend para evitar copiar
  variables de servidor al build de la SPA.

### 2.6 Red, puertos y dominio

| Elemento | Estado actual / destino |
|---|---|
| SPA | Vercel, HTTPS 443 |
| Flask | Render, HTTPS 443 → puerto interno 5050 |
| Coolify | v4.4.6 instalado en `vmi3680276`; panel en `127.0.0.1:8000` |
| Acceso panel | Solo por túnel SSH; no abrir 8000 a Internet |
| Proxy | Traefik; 80/443 permitidos en UFW |
| Puertos publicados por Coolify | 8000, 6001-6002 y 8080 según la guía; revisar con `docker ps` y `ss -tulnp` |
| DB/Redis | 5432/6379 deben permanecer internos, sin publicar |
| Dominio | Aún no adquirido; no hay DNS ni HTTPS de aplicación |
| Firewall | UFW deniega entrante por defecto; permite 22, 80 y 443 |

Riesgo: Docker puede publicar puertos por encima de UFW. Antes de alojar datos
sensibles hay que verificar la exposición real desde una red externa.

### 2.7 CI y validación local

- Workflows actuales: ESLint/Semgrep (`lint-and-static.yml`) y
  Trivy/TruffleHog (`security-scan.yml`). No hay build, tests ni `docker build`
  como puerta obligatoria.
- Línea base local ejecutada el 2026-10-23:
  - `npm ci`: OK; reporta 10 vulnerabilidades totales (4 moderadas, 5 altas,
    1 crítica), incluidas dependencias de desarrollo.
  - `npm run lint`: 0 errores, 14 advertencias conocidas.
  - `npm test`: 78 pruebas pasan (13 archivos).
  - `npm run build`: OK; advertencia por chunks grandes (`App` 707,40 kB,
    `exceljs` 929,58 kB).
  - `npm audit --omit=dev`: 2 vulnerabilidades de producción (1 alta, 1 crítica)
    en `dompurify@3.4.13`; el arreglo disponible exige `3.4.17`, fuera del rango
    declarado. Revisar antes de desplegar.
  - `pytest` con Python 3.14.7: 123 pruebas pasan.
  - `docker compose config`: válido.
  - `docker build` / `docker compose up`: pendiente; el daemon de Docker Desktop
    no está iniciado.

### 2.8 Matriz de preparación para Coolify

| Requisito de la guía | Estado local | Acción |
|---|---|---|
| Dockerfile por servicio | Backend y SPA sí | Validar builds cuando Docker Desktop esté activo |
| `.dockerignore` | Backend y raíz sí | Revisar exclusiones antes de construir |
| `.env.example` sin secretos | Sí, separado frontend/backend | Cargar secretos solo en Coolify |
| Proceso foreground / SIGTERM | Backend sí; Nginx `daemon off` | Verificar al levantar la pila |
| Escucha en `0.0.0.0` | Backend y Nginx sí | Verificar al levantar la pila |
| Healthcheck | Backend y PostgreSQL/Redis; SPA en Nginx | Definir `/health` estático si se requiere |
| Persistencia | PostgreSQL y Redis con volúmenes locales | Migrar a volúmenes Coolify |
| Secretos fuera de Git | Sí | Cargar en Coolify |
| Respaldo/restauración | No documentado | Documentar y probar `pg_dump`/restore |
| Redis | Servicio en `compose.yaml` | Crear servicio interno en Coolify |
| Dominio/HTTPS | No | Túnel al inicio; DNS/HTTPS al comprar dominio |
| URL de API configurable | Sí (`VITE_CERT_API_URL`) | Configurar en build de Coolify |
| CI con build/tests/Docker | No | Completar Fase 6 o gate específico |

## 3. Configuración Coolify (7.2)

- [ ] Servidor: Contabo VPS 4 `vmi3680276` (Ubuntu 24.04.5 LTS), 4 vCPU, 8 GB
      RAM, 100 GB SSD, IP `85.239.246.184`.
- [ ] Acceso SSH preferido:
      `ssh -i ~/.ssh/contabo_emprendelab root@85.239.246.184` (puerto 22).
      Permisos: `chmod 700 ~/.ssh`, `chmod 600 ~/.ssh/contabo_emprendelab`,
      `chmod 644 ~/.ssh/contabo_emprendelab.pub`.
- [ ] La llave `~/.ssh/contabo_emprendelab` **aún no está disponible en el equipo
      local**. Se solicitó/entregará por canal seguro; no se pega en Git ni en
      este documento.
- [ ] Panel Coolify solo por túnel:
      `ssh -i ~/.ssh/contabo_emprendelab -N -L 8000:127.0.0.1:8000 root@85.239.246.184`
      → `http://localhost:8000`.
- [ ] Coolify v4.4.6 + Docker + Traefik ya instalado.
- [ ] Verificación inicial: `whoami`, `hostname`, `cat /etc/os-release`,
      `free -h`, `df -h /`, `docker ps`, `ss -tulnp`, `ufw status verbose`.
- [ ] Proyecto/ambiente `production` creado.
- [ ] Integración Git (Deploy Key/GitHub App) configurada.
- [ ] Rama a desplegar definida.
- [ ] Seguridad: copia cifrada de `/data/coolify/source/.env` fuera del VPS;
      mantener sesión SSH abierta al modificar firewall/SSH; revisar puertos
      publicados por Docker (8000, 6001-6002, 8080).

## 4. Backend Flask en Coolify (7.3)

- [ ] Recurso desde `backend/` con Build Pack Dockerfile.
- [ ] Puerto interno 5050.
- [ ] Healthcheck `GET /api/health`.
- [ ] Variables de producción cargadas en Coolify.
- [ ] Redis provisionado para `RATELIMIT_STORAGE_URI` (interno o externo).
- [ ] CORS validado contra el origen real del SPA.
- [ ] Verificado: usuario no-root, Gunicorn `app:app`, logs stdout/stderr.
- [ ] Migración `20260812000000_secure_svg_templates.sql` aplicada.
- [ ] Migración `20260819000000_harden_participant_transactions.sql` aplicada si
      corresponde al despliegue del frontend.

## 5. SPA Frontend (7.4)

- [ ] Decisión: migrar a Coolify (Nginx estático) o mantener Vercel temporal.
- [x] Build Vite y servir `dist/` con Nginx; proceso foreground.
- [x] Añadir Dockerfile raíz, `nginx.conf` y `.dockerignore` raíz.
- [x] Hacer configurable la URL del backend (`VITE_CERT_API_URL`) y dejar Render
      solo como fallback.
- [ ] Actualizar `CORS_ALLOWED_ORIGINS` del backend al origen del SPA.
- [ ] Variables `VITE_*` configuradas en Coolify/Vercel.
- [ ] Healthcheck del contenedor estático (`/` o `/health`).

## 6. PostgreSQL en Coolify y corte (7.5)

- [ ] Crear servicio PostgreSQL en Coolify con volumen persistente, credenciales
      fuertes, `5432` solo en red interna (sin publicar a Internet).
- [ ] Dimensionar PostgreSQL para el VPS (8 GB RAM/4 vCPU) y revisar conexiones.
- [ ] Definir topología: autoalojar Supabase completo (Auth+Storage+Postgres) o
      mover solo PostgreSQL y adaptar el frontend/backend (el `supabase-js` actual
      no habla directo a Postgres). Registrar decisión en `docs/COOLIFY_MIGRATION.md`.
- [ ] Hacer dump de la base actual (`pg_dump`/herramienta Supabase), restaurar
      en PostgreSQL de Coolify, aplicar migraciones versionadas y validar
      conteos/relaciones/RLS.
- [ ] Respaldar Storage de plantillas y restauración probada.
- [ ] Ventana de corte definida, congelar escrituras si necesario.
- [ ] DNS apuntando a Coolify/Traefik con HTTPS cuando exista dominio.
- [ ] Verificaciones post-corte: healthchecks, login, CRUD, certificados
      individuales y por lote, importación/exportación, conexión a PostgreSQL y
      persistencia tras recrear contenedor, logs y consumo.
- [ ] Rollback documentado y probado; mantener Render/Vercel/Supabase activos hasta
      superar el monitoreo.

## 7. Checklist de aceptación (7.6)

- [ ] El repo clona y la compilación de producción termina sin errores.
- [ ] Se ejecuta sin dependencias del equipo del desarrollador.
- [ ] Puerto e interfaz correctos; el proxy enruta sin exponer servicios internos.
- [ ] Variables documentadas; secretos fuera del repositorio y de la imagen.
- [ ] Healthcheck correcto; arranque y reinicio exitosos.
- [ ] Datos y archivos persisten tras recrear el contenedor.
- [ ] Respaldo externo y prueba de restauración satisfactorios.
- [ ] Sin credenciales en logs; permisos mínimos; dependencias revisadas.
- [ ] Consumo de RAM/CPU/disco y alertas revisados.
- [ ] Rollback y procedimiento de migración documentados.

## 8. Hallazgos y pendientes

- Docker puede publicar puertos fuera de UFW: revisar con `docker ps` y
  `ss -tulnp`, y probar desde red externa antes de alojar datos sensibles.
  PostgreSQL `5432` debe permanecer en la red interna de Coolify, sin publicar.
- Redis es obligatorio en producción para el rate limiting. No hay servicio
  definido; provisionarlo antes de desplegar el backend.
- PostgreSQL de la app se alojará en Coolify con volumen persistente. Se debe
  decidir entre autoalojar Supabase completo o mover solo PostgreSQL y adaptar
  el frontend/backend; `supabase-js` no apunta directamente a Postgres.
- Recursos del VPS 8 GB/4 vCPU: dimensionar PostgreSQL, Redis, Flask, SPA y
  Traefik para evitar quedarse sin memoria.
- `CERT_API` está hardcodeado en `src/config.js`; actualizarlo de forma coordinada
  con `CORS_ALLOWED_ORIGINS`.
- `SUPABASE_SERVICE_ROLE_KEY` solo debe existir en el backend/Coolify; nunca en
  variables `VITE_*`.
- No hay dominio: el primer despliegue se valida por túnel. No publicar datos
  sensibles hasta tener HTTPS y control de acceso.
- `vercel.json` y las referencias a Render/Vercel quedan vigentes hasta el corte;
  no eliminarlas antes de validar Coolify.
- Aplicar las migraciones pendientes en Supabase remoto antes del despliegue.
- No hay scripts de respaldo/restauración; documentarlos y ensayarlos (dump de
  PostgreSQL + restauración probados).
- `npm audit --omit=dev` reporta vulnerabilidades de producción en
  `dompurify@3.4.13`; actualizar a una versión corregida y validar los
  sanitizadores SVG antes de exponer el despliegue en Coolify.

## 9. Próximos pasos locales (sin acceso al VPS)

### 9.1 Pila Docker local

Archivos creados:

- `Dockerfile` raíz: build Vite + Nginx.
- `nginx.conf`: SPA fallback, gzip, caché y cabeceras de seguridad.
- `.dockerignore` raíz.
- `compose.yaml`: PostgreSQL 17, Redis 7, backend Flask y frontend Nginx.
- `src/config.js`: URL del backend configurable por `VITE_CERT_API_URL`.
- `.env.example`: variables separadas de frontend/backend y PostgreSQL.

Comandos:

```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

Accesos locales:

| Servicio | URL / puerto |
|---|---|
| Frontend | http://localhost:8080 |
| Backend | http://localhost:5050/api/health |
| PostgreSQL | `127.0.0.1:5432` (solo local) |
| Redis | `127.0.0.1:6379` (solo local) |

Notas:

- PostgreSQL local aún no es consumido por la aplicación: el frontend sigue
  usando Supabase y Flask no tiene adaptador Postgres. La pila sirve para
  validar infraestructura, migraciones/dump y paridad con Coolify.
- Para borrar también los datos: `docker compose down -v` (destructivo).
- Para paridad con Coolify, usar `APP_ENV=production` en `.env` y cargar
  `SUPABASE_SERVICE_ROLE_KEY` y demás secretos reales.

### 9.2 Tareas pendientes

1. [x] Ejecutar `npm ci` y registrar línea base de `npm run lint`, `npm test` y
   `npm run build`.
2. [x] Crear `.venv`, instalar `backend/requirements-dev.txt` y ejecutar pytest.
3. [ ] Iniciar Docker Desktop y validar
   `docker compose up -d --build`.
4. [ ] Decidir topología: SPA Nginx + Flask + Redis + PostgreSQL en Coolify
   (Postgres con volumen persistente, 5432 interno). Definir si Supabase
   Auth/Storage se autoaloja o se mantienen en Supabase gestionado; documentar
   en este archivo.
5. [ ] Ensayar `pg_dump` de la base actual y restauración en el PostgreSQL local
   (sin ejecutar las migraciones Supabase desde cero).
6. [ ] Resolver hallazgos de `npm audit` de producción (DOMPurify).
7. [ ] Solicitar la llave SSH por canal seguro para continuar con 7.2 (verificar
   puertos, confirmar red interna de Postgres).

## Registro de avances

| Fecha | Acción | Estado | Notas |
|---|---|---|---|
| 2026-10-23 | Creación del documento | OK | Inicio de Fase 7 |
| 2026-10-23 | Inventario local de repo, frontend, backend, datos y variables | OK | Detectados faltantes de Dockerfile SPA, URL configurable, Redis y respaldos |
| 2026-10-23 | Línea base local de lint/tests/build | OK | Lint 0 errores/14 advertencias; 78 Vitest; 123 pytest; build OK con chunks grandes; `npm audit --omit=dev` reporta 2 vulnerabilidades de producción |
| 2026-10-23 | Docker build del backend | BLOQUEADO | Daemon de Docker Desktop detenido |
| 2026-10-23 | Acceso al VPS | BLOQUEADO | La llave `~/.ssh/contabo_emprendelab` aún no está disponible |

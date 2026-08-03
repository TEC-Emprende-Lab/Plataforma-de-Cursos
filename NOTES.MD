# Notas para la Evaluación de Calidad

## 1. Configuración del ambiente de desarrollo

### Caso A: El proyecto cuenta con migraciones (`supabase/`)

#### Procedimiento

1. Crear un ambiente de desarrollo independiente.
2. Levantar una instancia local de Supabase mediante Docker.
3. Ejecutar las migraciones para recrear el esquema de la base de datos.
4. Poblar la base de datos con datos de prueba (*seed*), si existen.
5. Configurar las variables de entorno locales (`.env.local`).

#### Resultado esperado

Los desarrolladores pueden ejecutar, probar y depurar la aplicación sin acceder a la base de datos de producción.

---

### Caso B: El proyecto no cuenta con migraciones (`supabase/`)

#### Hallazgo

No es posible reconstruir automáticamente el esquema de la base de datos, por lo que el proyecto depende de la instancia de producción para su ejecución.

#### Impacto

- No puede levantarse un ambiente de desarrollo reproducible.
- Las pruebas locales requieren acceso a la base de datos de producción.
- Existe riesgo de modificar datos reales durante el desarrollo.
- Se dificulta la incorporación de nuevos desarrolladores.
- La continuidad y mantenibilidad del proyecto dependen del acceso a la base de datos existente.

#### Recomendaciones

- Documentar el proceso de inicialización del entorno.
- Mantener variables de entorno separadas para desarrollo y producción.
- Versionar el esquema de la base de datos mediante migraciones.
- Una vez disponibles las migraciones, utilizar Supabase local (Docker) como ambiente de desarrollo.

#### Resultado esperado

El proyecto dispone de un ambiente de desarrollo independiente, reproducible y desacoplado de la base de datos de producción.

---

# 2. Evaluación estática del código

Se recomienda utilizar un contenedor Docker que concentre todas las herramientas de análisis estático, evitando instalaciones adicionales en el sistema anfitrión.

## Herramientas

- SonarQube Community Build
- ESLint
- Prettier
- Husky
- depcheck

## Objetivos

- Detectar *code smells*.
- Identificar errores potenciales.
- Medir la complejidad del código.
- Detectar duplicación de código.
- Verificar la consistencia del estilo.
- Identificar dependencias sin uso.
- Validar tipos de TypeScript.
- Automatizar verificaciones antes de cada *commit*.

---

# 3. Pruebas automatizadas

## Pruebas unitarias

**Herramienta:** Vitest

### Objetivos

- Validar funciones y componentes de manera aislada.
- Detectar regresiones de forma temprana.
- Facilitar la refactorización del código.

---

## Pruebas End-to-End (E2E)

**Herramienta:** Playwright

### Objetivos

- Simular flujos completos del usuario.
- Validar la integración entre frontend, backend y base de datos.
- Verificar el funcionamiento del sistema desde la perspectiva del usuario final.

---

# 4. Monitoreo de errores

**Herramienta:** Sentry

## Objetivos

- Capturar excepciones en producción.
- Obtener *stack traces* detallados.
- Detectar errores recurrentes.
- Facilitar el diagnóstico posterior al despliegue.
- Monitorear la estabilidad de la aplicación.

---

# Flujo de calidad propuesto

```text
Repositorio
      │
      ▼
Clonar proyecto
      │
      ▼
¿Existen migraciones?
      │
      ├────────────── Sí ──────────────┐
      │                                │
      ▼                                ▼
Levantar Supabase local         Registrar hallazgo:
con Docker                      No existe ambiente reproducible
      │                                │
      └──────────────┬─────────────────┘
                     ▼
        Configurar variables de entorno
                     │
                     ▼
      Análisis estático del código
 (SonarQube + ESLint + Prettier +
   depcheck + TypeScript + Husky)
                     │
                     ▼
        Pruebas automatizadas
      (Vitest + Playwright)
                     │
                     ▼
       Corrección de hallazgos
                     │
                     ▼
              Despliegue
                     │
                     ▼
        Monitoreo continuo (Sentry)
```

# Notas sobre cambio de base de datos

Se quiere mantener el uso de PosgreSQL pero sin Supabase, por lo que se ocuparia un nuevo host de base de datos, autenticacion y ORM.

## Opciones para Base de Datos
| Opción | Complejidad | Costo | Cuándo usarla |
|--------|-------------|-------|---------------|
| **Neon (PostgreSQL administrado)** | Baja | Gratis con límites / Pago según uso | Proyectos modernos, startups y aplicaciones pequeñas o medianas que necesitan PostgreSQL sin administrar infraestructura. Buena integración con aplicaciones serverless. |
| **Railway (PostgreSQL administrado)** | Baja | Gratis con límites / Pago según consumo | Proyectos pequeños y medianos que buscan desplegar base de datos y servicios rápidamente con una configuración sencilla. |
| **Amazon RDS PostgreSQL** | Media | Pago según recursos utilizados | Sistemas empresariales que requieren alta disponibilidad, escalabilidad, backups administrados y soporte dentro del ecosistema AWS. |
| **Google Cloud SQL PostgreSQL** | Media | Pago según recursos utilizados | Empresas que utilizan Google Cloud y necesitan una base de datos administrada con integración con otros servicios de GCP. |
| **Azure Database for PostgreSQL** | Media | Pago según recursos utilizados | Organizaciones que trabajan con Microsoft Azure y requieren integración empresarial. |
| **Render PostgreSQL** | Baja | Gratis con límites / Pago según plan | Proyectos pequeños y medianos que buscan una plataforma sencilla para desplegar aplicaciones y bases de datos juntas. |

## Opciones para Auth

| Opción | Complejidad | Costo | Cuándo usarla |
|--------|-------------|-------|---------------|
| **Auth.js + Prisma + PostgreSQL** | Baja | Gratis | Una sola aplicación web con requisitos estándar de autenticación. Ideal para proyectos pequeños y medianos. |
| **Keycloak + PostgreSQL** | Media | Gratis (licencia Open Source) | Cuando se requiere SSO, múltiples aplicaciones, MFA, integración con políticas avanzadas de identidad. |
| **Auth0** | Baja | Gratis con límites / Pago según uso | Cuando se desea delegar completamente la gestión de identidad a un proveedor especializado. Recomendado para empresas que necesitan funcionalidades avanzadas sin administrar infraestructura. |
| **Clerk** | Baja | Gratis con límites / Pago según uso | Aplicaciones modernas con necesidad de implementar autenticación rápidamente, especialmente en ecosistemas React/Next.js. |
| **Firebase Authentication** | Baja | Gratis con límites / Pago según uso | Aplicaciones que ya utilizan Firebase o necesitan una solución rápida con múltiples proveedores de login. |

## Opciones para ORM
| Opción | Complejidad | Costo | Cuándo usarla |
|--------|-------------|-------|---------------|
| **Prisma** | Baja | Gratis (Open Source) / Pago para funciones empresariales | Aplicaciones modernas con TypeScript/Node.js que buscan productividad, buen tipado y migraciones sencillas. Recomendado para la mayoría de proyectos React/Next.js. |
| **Drizzle ORM** | Baja/Media | Gratis (Open Source) | Proyectos que quieren mayor cercanía con SQL, excelente rendimiento y menor abstracción que Prisma. Ideal para desarrolladores que prefieren control sobre las consultas. |
| **TypeORM** | Media | Gratis (Open Source) | Proyectos Node.js empresariales, especialmente con NestJS. Ofrece un enfoque orientado a entidades similar a otros ORMs tradicionales. |
| **Sequelize** | Media | Gratis (Open Source) | Proyectos existentes en Node.js que requieren un ORM maduro y ampliamente utilizado. Menos recomendado para proyectos nuevos con TypeScript moderno. |
| **MikroORM** | Media | Gratis (Open Source) | Aplicaciones complejas que requieren patrones avanzados de persistencia y un ORM orientado a objetos. |
| **SQLAlchemy** | Media | Gratis (Open Source) | Backends desarrollados en Python (FastAPI, Flask, Django fuera del ORM propio). Muy utilizado en aplicaciones profesionales. |
| **Django ORM** | Baja/Media | Gratis (Open Source) | Aplicaciones desarrolladas completamente con Django. Incluye ORM, migraciones y administración integrada. |
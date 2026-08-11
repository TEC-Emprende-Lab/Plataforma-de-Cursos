# Pipeline de Calidad y Seguridad

## 1. Propósito

El pipeline tiene como objetivo **apoyar los procesos de auditoría del proyecto**, automatizando revisiones de calidad de código, seguridad y dependencias.

Los resultados generados por las herramientas se centralizan en formato **SARIF (Static Analysis Results Interchange Format)**, permitiendo que GitHub los registre en la sección de **Code Scanning** y facilite su revisión durante una auditoría.

El pipeline no busca sustituir una auditoría manual, sino proporcionar evidencia automatizada y repetible sobre el estado del código y sus posibles riesgos.

---

## 2. Herramientas utilizadas

El pipeline utiliza cuatro herramientas principales:

| Herramienta    | Propósito                                                        | Tipo de análisis  |
| -------------- | ---------------------------------------------------------------- | ----------------- |
| **ESLint**     | Detectar problemas de calidad y errores potenciales en el código | Análisis estático |
| **Semgrep**    | Identificar patrones de código potencialmente inseguros          | SAST              |
| **Trivy**      | Detectar vulnerabilidades conocidas en dependencias              | SCA               |
| **TruffleHog** | Detectar secretos o credenciales expuestas en el repositorio     | Secret Scanning   |

Todas las herramientas generan resultados que terminan siendo reportados mediante **SARIF**.

---

## 3. Flujo general

El pipeline se ejecuta automáticamente cuando ocurre alguno de los siguientes eventos:

* Un `push` hacia `main` o `develop`.
* Un `pull request` hacia `main` o `develop`.
* Una ejecución manual mediante `workflow_dispatch` cuando está configurada.

De forma general, el flujo es:

```text
                 ┌──────────────┐
                 │   GitHub     │
                 │ Push / PR    │
                 └──────┬───────┘
                        │
                        ▼
              ┌───────────────────┐
              │ Ejecución Pipeline│
              └─────────┬─────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
      ┌───────┐     ┌────────┐    ┌────────┐
      │ESLint │     │Semgrep │    │ Trivy  │
      └───┬───┘     └───┬────┘    └───┬────┘
          │             │              │
        SARIF         SARIF          SARIF
          │             │              │
          └─────────────┼──────────────┘
                        │
                        ▼
                ┌─────────────┐
                │ GitHub Code │
                │   Scanning  │
                └─────────────┘

                        ▲
                        │
                  ┌─────┴──────┐
                  │ TruffleHog │
                  └─────┬──────┘
                        │
                   JSON → SARIF
```

---

## 4. Análisis de calidad

### ESLint

ESLint se utiliza para revisar el código fuente y detectar problemas relacionados con las reglas de calidad configuradas para el proyecto.

El resultado se genera directamente en formato SARIF:

```text
eslint-results.sarif
```

Este archivo se envía posteriormente a GitHub Code Scanning.

**Objetivo para auditoría:** proporcionar evidencia automatizada sobre problemas de calidad y cumplimiento de las reglas de linting.

---

## 5. Análisis de seguridad

### Semgrep

Semgrep realiza un análisis **SAST (Static Application Security Testing)**.

Busca patrones de código que puedan representar vulnerabilidades o prácticas inseguras.

El resultado se genera como:

```text
semgrep-results.sarif
```

Este resultado se carga en GitHub Code Scanning.

**Objetivo para auditoría:** identificar posibles vulnerabilidades presentes directamente en el código fuente.

---

### Trivy

Trivy se utiliza para realizar un análisis **SCA (Software Composition Analysis)**.

A diferencia de Semgrep, que analiza principalmente el código, Trivy permite identificar vulnerabilidades conocidas asociadas con las dependencias utilizadas por el proyecto.

El resultado se genera como:

```text
trivy-results.sarif
```

Se consideran principalmente vulnerabilidades de severidad:

```text
HIGH
CRITICAL
```

Además, se ignoran vulnerabilidades para las cuales todavía no existe una corrección disponible.

**Objetivo para auditoría:** proporcionar evidencia sobre el estado de seguridad de las dependencias utilizadas por la aplicación.

---

### TruffleHog

TruffleHog se utiliza para buscar **secretos o credenciales expuestas** dentro del repositorio.

La configuración actual busca específicamente secretos que hayan sido verificados por la herramienta.

El flujo es:

```text
TruffleHog
     │
     ▼
 JSON
     │
     ▼
 Conversión a SARIF
     │
     ▼
GitHub Code Scanning
```

**Objetivo para auditoría:** detectar posibles credenciales, API keys u otros secretos que hayan sido incluidos accidentalmente en el código o historial del repositorio.

---

## 6. Uso de SARIF

SARIF permite utilizar un formato estándar para representar los resultados de diferentes herramientas de análisis.

En este pipeline, los resultados de:

* ESLint
* Semgrep
* Trivy
* TruffleHog

son reportados mediante SARIF.

Esto permite centralizar los hallazgos en **GitHub Code Scanning**, facilitando su consulta y seguimiento durante las auditorías.

Por ejemplo, una auditoría puede revisar:

```text
Repository
   └── Security
       └── Code scanning
           ├── ESLint findings
           ├── Semgrep findings
           ├── Trivy findings
           └── TruffleHog findings
```

Esto proporciona una fuente centralizada de evidencia sobre los análisis automatizados realizados al proyecto.

---

## 7. Valor para auditoría

El pipeline proporciona principalmente **evidencia automatizada y reproducible** sobre cuatro aspectos:

| Área                      | Evidencia proporcionada                        |
| ------------------------- | ---------------------------------------------- |
| Calidad                   | Problemas detectados por ESLint                |
| Seguridad del código      | Hallazgos de Semgrep                           |
| Seguridad de dependencias | Vulnerabilidades detectadas por Trivy          |
| Protección de secretos    | Secretos verificados detectados por TruffleHog |

Cada ejecución del pipeline permite comprobar que estas revisiones fueron realizadas sobre el código correspondiente al commit o Pull Request analizado.

De esta manera, el pipeline funciona como un **mecanismo de apoyo a la auditoría**, facilitando la identificación de riesgos y proporcionando evidencia técnica de los controles automatizados aplicados al proyecto.

---

## 8. Alcance actual

El pipeline actualmente se enfoca en:

* Análisis estático del código.
* Análisis de seguridad del código.
* Análisis de dependencias.
* Detección de secretos.
* Generación de resultados en SARIF.
* Centralización de hallazgos en GitHub Code Scanning.

No cubre actualmente:

* Validación funcional de las funcionalidades del sistema.
* Pruebas end-to-end.
* Pruebas de integración.
* Pruebas de rendimiento.
* Validación completa de requisitos funcionales.
* Monitoreo

Estas actividades podrán incorporarse posteriormente cuando el stack tecnológico y la arquitectura del proyecto estén definidos con mayor certeza.

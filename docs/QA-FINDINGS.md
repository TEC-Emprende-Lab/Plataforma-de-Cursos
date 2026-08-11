# Clasificación de hallazgos según criterios de calidad del software

## 1. Introducción

Los análisis realizados mediante **Trivy, Semgrep OSS y ESLint** permitieron identificar diferentes problemas relacionados con la seguridad y la calidad interna del software.

Para realizar una evaluación integral, los hallazgos se clasifican según el atributo de calidad del software que pueden afectar. Un mismo hallazgo puede pertenecer a más de un criterio cuando su impacto se relaciona con diferentes aspectos del sistema.

Los criterios utilizados son:

| Criterio           | Descripción                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Seguridad**      | Capacidad del software para proteger la información, los recursos y las funcionalidades frente a accesos o comportamientos no autorizados. |
| **Confiabilidad**  | Capacidad del software para mantener un funcionamiento correcto y consistente durante su ejecución.                                        |
| **Mantenibilidad** | Facilidad para comprender, modificar, corregir y evolucionar el software.                                                                  |
| **Consistencia**   | Grado en que el código mantiene reglas, convenciones y comportamientos uniformes.                                                          |
| **Rendimiento**    | Capacidad del sistema para utilizar adecuadamente los recursos y mantener tiempos de respuesta aceptables.                                 |

> **Nota:** Algunos hallazgos pueden pertenecer simultáneamente a varios criterios. Por ejemplo, una vulnerabilidad de Denial of Service afecta principalmente la **seguridad**, pero también puede afectar la **confiabilidad** y el **rendimiento** del sistema.

---

# 2. Resumen general de hallazgos

Los análisis automatizados identificaron problemas en dependencias, configuración de infraestructura, pipeline CI/CD y código frontend/backend.

Para evitar contabilizar múltiples veces un mismo problema, los hallazgos repetidos se consolidan por tipo de problema.

| ID   | Hallazgo                          | Herramienta | Criterio principal | Criterios relacionados       | Prioridad  |
| ---- | --------------------------------- | ----------- | ------------------ | ---------------------------- | ---------- |
| Q-01 | Vulnerabilidades en Pillow        | Trivy       | Seguridad          | Confiabilidad, Rendimiento   | Alta       |
| Q-02 | Vulnerabilidades en lxml          | Trivy       | Seguridad          | Confiabilidad                | Alta       |
| Q-03 | Vulnerabilidades en SheetJS       | Trivy       | Seguridad          | Confiabilidad                | Alta       |
| Q-04 | Vulnerabilidades en CairoSVG      | Trivy       | Seguridad          | Confiabilidad, Rendimiento   | Media-Alta |
| Q-05 | Vulnerabilidades en DOMPurify     | Trivy       | Seguridad          | Confiabilidad                | Media      |
| Q-06 | Vulnerabilidades en flask-cors    | Trivy       | Seguridad          | Confiabilidad                | Media      |
| Q-07 | Vulnerabilidad en Flask           | Trivy       | Seguridad          | Confiabilidad                | Baja       |
| Q-08 | Contenedor ejecutándose como root | Semgrep     | Seguridad          | Confiabilidad                | Alta       |
| Q-09 | `dangerouslySetInnerHTML`         | Semgrep     | Seguridad          | Confiabilidad                | Media-Alta |
| Q-10 | Ausencia de SRI                   | Semgrep     | Seguridad          | Mantenibilidad               | Baja-Media |
| Q-11 | Uso de `app.run()` en Flask       | Semgrep     | Confiabilidad      | Seguridad, Mantenibilidad    | Media      |
| Q-12 | Construcción dinámica de URLs     | Semgrep     | Seguridad          | Confiabilidad                | Media      |
| Q-13 | Cadenas de formato dinámicas      | Semgrep     | Mantenibilidad     | Consistencia                 | Baja       |
| Q-14 | Incumplimiento de Rules of Hooks  | ESLint      | Confiabilidad      | Consistencia, Mantenibilidad | Alta       |
| Q-15 | Dependencias incorrectas en Hooks | ESLint      | Confiabilidad      | Consistencia, Mantenibilidad | Media      |
| Q-16 | Variables no utilizadas           | ESLint      | Mantenibilidad     | Consistencia                 | Baja-Media |

---

# 3. Seguridad

La seguridad constituye uno de los principales criterios afectados por los resultados obtenidos. Los hallazgos de Trivy y Semgrep identifican vulnerabilidades en dependencias, configuraciones inseguras y patrones de programación que podrían permitir ataques o aumentar el impacto de una vulnerabilidad.

## 3.1 Vulnerabilidades en dependencias

### Q-01 — Vulnerabilidades en Pillow

**Herramienta:** Trivy
**Ubicación:** `backend/requirements.txt:5`

Pillow presenta múltiples vulnerabilidades relacionadas con el procesamiento de imágenes y otros formatos de archivos.

Entre los problemas identificados se encuentran:

* Ejecución de código.
* Inyección de comandos mediante rutas de archivos.
* Lecturas fuera de límites de memoria.
* Denegación de servicio mediante archivos PDF.
* Desbordamientos de enteros durante el procesamiento de fuentes.

### Impacto en la calidad

**Seguridad:** Alto. Algunas vulnerabilidades podrían permitir ejecución de código o manipulación de recursos.

**Confiabilidad:** Un archivo malicioso podría provocar errores o comportamientos inesperados.

**Rendimiento:** Las vulnerabilidades de DoS podrían provocar consumo excesivo de recursos.

### Evaluación

**Prioridad: Alta.**

Se recomienda actualizar Pillow a una versión corregida y verificar las funcionalidades que procesan imágenes o archivos proporcionados por usuarios.

---

## 3.2 Vulnerabilidades en lxml

### Q-02 — Acceso potencial a archivos locales mediante XML

**Herramienta:** Trivy
**Ubicación:** `backend/requirements.txt`

lxml presenta vulnerabilidades relacionadas con el procesamiento de contenido XML.

### Impacto en la calidad

**Seguridad:** Alto, debido a la posibilidad de acceder a información local mediante contenido XML malicioso.

**Confiabilidad:** Los documentos malformados o maliciosos pueden producir comportamientos inesperados durante el procesamiento.

### Evaluación

**Prioridad: Alta.**

Se recomienda actualizar lxml y revisar si la aplicación procesa documentos XML proporcionados por usuarios.

---

## 3.3 Vulnerabilidades en SheetJS

### Q-03 — Prototype Pollution y ReDoS

**Herramienta:** Trivy

Las vulnerabilidades identificadas en SheetJS incluyen problemas relacionados con **Prototype Pollution** y **Regular Expression Denial of Service (ReDoS)**.

### Impacto en la calidad

**Seguridad:** Alto, especialmente si se procesan archivos proporcionados por usuarios.

**Confiabilidad:** Un archivo malicioso podría alterar el comportamiento de la aplicación.

**Rendimiento:** ReDoS puede provocar un consumo excesivo de CPU.

### Evaluación

**Prioridad: Alta.**

Debe actualizarse la dependencia y verificarse el procesamiento de archivos de hojas de cálculo.

---

## 3.4 Vulnerabilidades en CairoSVG

### Q-04 — Denegación de servicio mediante SVG

**Herramienta:** Trivy

CairoSVG presenta una vulnerabilidad relacionada con el procesamiento de archivos SVG que puede provocar condiciones de Denial of Service.

### Impacto en la calidad

**Seguridad:** Un atacante podría utilizar un archivo especialmente diseñado para afectar la disponibilidad del servicio.

**Confiabilidad:** El procesamiento de un archivo malicioso podría provocar fallos.

**Rendimiento:** Puede producir consumo excesivo de recursos.

### Evaluación

**Prioridad: Media-Alta.**

Se recomienda actualizar CairoSVG y establecer límites sobre los archivos procesados.

---

## 3.5 Vulnerabilidades en DOMPurify

### Q-05 — Bypass de mecanismos de sanitización

**Herramienta:** Trivy
**Ubicación:** `package-lock.json:2416`

Los hallazgos incluyen problemas relacionados con:

* `CUSTOM_ELEMENT_HANDLING`.
* `SAFE_FOR_TEMPLATES`.
* Trusted Types.

Estas vulnerabilidades pueden permitir evadir determinados mecanismos de sanitización bajo condiciones específicas.

### Impacto en la calidad

**Seguridad:** Alto potencial si la aplicación procesa contenido HTML proporcionado por usuarios.

**Confiabilidad:** Un contenido incorrectamente sanitizado puede producir comportamientos no esperados.

### Evaluación

**Prioridad: Media.**

Se recomienda actualizar DOMPurify y revisar las configuraciones utilizadas para la sanitización de contenido.

---

## 3.6 Vulnerabilidades en flask-cors

### Q-06 — Configuración y procesamiento de solicitudes Cross-Origin

**Herramienta:** Trivy
**Ubicación:** `backend/requirements.txt:2`

Se identificaron vulnerabilidades en `flask-cors` relacionadas con el procesamiento de rutas y solicitudes Cross-Origin.

### Impacto en la calidad

**Seguridad:** El impacto aumenta si se permiten orígenes no confiables o solicitudes con credenciales.

**Confiabilidad:** Una configuración incorrecta puede afectar la comunicación entre frontend y backend.

### Evaluación

**Prioridad: Media.**

Se recomienda:

* Actualizar `flask-cors`.
* Revisar los orígenes permitidos.
* Verificar el uso de credenciales.
* Evitar orígenes arbitrarios.
* Ejecutar pruebas de regresión sobre la comunicación frontend-backend.

---

## 3.7 Vulnerabilidad en Flask

### Q-07 — Divulgación de información mediante almacenamiento en caché

**Herramienta:** Trivy

Se identificó una vulnerabilidad relacionada con el almacenamiento en caché de información de sesión.

### Impacto en la calidad

**Seguridad:** Existe un riesgo potencial de exposición de información de sesión.

**Confiabilidad:** Una configuración incorrecta podría provocar que información de una sesión sea reutilizada incorrectamente.

### Evaluación

**Prioridad: Baja.**

Se recomienda actualizar Flask y revisar la configuración de sesiones y caché.

---

## 3.8 Contenedor ejecutándose como root

### Q-08 — Usuario privilegiado en Docker

**Herramienta:** Semgrep OSS
**ID:** #36
**Archivo:** `backend/Dockerfile:28`
**Regla:** `dockerfile.security.missing-user.missing-user`

Semgrep detectó que el contenedor no especifica un usuario sin privilegios mediante `USER`.

### Impacto en la calidad

**Seguridad:** Un atacante que consiga ejecutar código dentro del contenedor tendría privilegios superiores a los necesarios.

**Confiabilidad:** Una aplicación con privilegios excesivos puede provocar un mayor impacto ante errores o comportamientos inesperados.

### Evaluación

**Prioridad: Alta.**

Se recomienda crear un usuario sin privilegios y utilizarlo para ejecutar la aplicación.

---

## 3.9 `dangerouslySetInnerHTML`

### Q-09 — Inserción directa de HTML

**Herramienta:** Semgrep OSS
**IDs:** #54 y #55
**Archivo:** `src/components/GalleryView.jsx`

Se detectó el uso de `dangerouslySetInnerHTML`.

El riesgo depende principalmente del origen del contenido.

| Origen del HTML                              | Riesgo                |
| -------------------------------------------- | --------------------- |
| HTML estático controlado por desarrolladores | Bajo                  |
| HTML generado por el sistema                 | Requiere revisión     |
| HTML proporcionado por usuarios              | Alto                  |
| HTML proveniente de una API externa          | Requiere sanitización |
| HTML sanitizado mediante DOMPurify           | Reducido              |

### Impacto en la calidad

**Seguridad:** Posible vulnerabilidad XSS.

**Confiabilidad:** Contenido malicioso podría alterar el comportamiento de la interfaz.

### Evaluación

**Prioridad: Media**, potencialmente alta si el contenido es controlado por usuarios.

Se debe revisar el origen del contenido y utilizar DOMPurify cuando sea necesario insertar HTML dinámico.

---

## 3.10 Ausencia de Subresource Integrity

### Q-10 — Recursos externos sin SRI

**Herramienta:** Semgrep OSS
**IDs:** #40–#53
**Regla:** `html.security.audit.missing-integrity`

Se detectaron recursos externos cargados mediante `script` o `link` sin el atributo `integrity`.

### Impacto en la calidad

**Seguridad:** Si un recurso externo es comprometido, el navegador podría cargar contenido modificado.

**Mantenibilidad:** El uso de mecanismos de integridad facilita controlar las dependencias externas utilizadas por la aplicación.

### Evaluación

Los 14 hallazgos deben considerarse como **un mismo tipo de problema repetido**.

Además, los archivos dentro de `docs/mockups/` deben diferenciarse de los archivos utilizados realmente en producción.

**Prioridad: Baja-Media.**

---

## 3.11 URLs dinámicas

### Q-12 — Construcción dinámica de URLs

**Herramienta:** Semgrep OSS
**IDs:** #37 y #38
**Archivos:** `backend/app.py:79` y `backend/app.py:1017`

Semgrep detectó utilización dinámica de URLs mediante funcionalidades de `urllib`.

El riesgo aparece cuando una URL puede ser controlada por un usuario y posteriormente utilizada para realizar solicitudes.

### Impacto en la calidad

**Seguridad:** Puede existir riesgo de SSRF.

**Confiabilidad:** Solicitudes hacia destinos inesperados pueden afectar el funcionamiento del sistema.

### Evaluación

**Prioridad: Media**, potencialmente alta si las URLs provienen de usuarios.

Se recomienda:

* Validar las URLs.
* Utilizar una allowlist de dominios.
* Validar el esquema.
* Bloquear `localhost`.
* Bloquear direcciones IP privadas.
* Bloquear endpoints de metadata.
* Normalizar las URLs antes de utilizarlas.

---


# 4. Confiabilidad

La confiabilidad se relaciona con la capacidad del software para funcionar correctamente y mantener un comportamiento predecible.

Los principales hallazgos de este criterio provienen de ESLint y Semgrep, además de determinadas vulnerabilidades de dependencias que pueden producir fallos o indisponibilidad.

## 4.1 Incumplimiento de las Rules of Hooks

### Q-14 — Uso incorrecto de React Hooks

**Herramienta:** ESLint
**Regla:** `react-hooks/rules-of-hooks`
**Archivo:** `src/components/ProfileView.jsx`
**Líneas:** 25–26
**Severidad:** Error

ESLint detectó un incumplimiento de las reglas de React Hooks.

Los Hooks deben ejecutarse siguiendo un orden consistente entre los diferentes renderizados del componente.

### Impacto

**Confiabilidad:** Puede provocar comportamientos inesperados durante la ejecución del componente.

**Consistencia:** El comportamiento puede variar dependiendo del flujo de ejecución.

**Mantenibilidad:** Incumplir las convenciones de React dificulta modificar el componente posteriormente.

### Evaluación

**Prioridad: Alta.**

Debe revisarse el código señalado y garantizar que los Hooks no se ejecuten dentro de condiciones, ciclos o funciones anidadas.

---

## 4.2 Dependencias incorrectas en Hooks

### Q-15 — Dependencias incompletas en `useEffect`

**Herramienta:** ESLint
**Regla:** `react-hooks/exhaustive-deps`

**Archivos afectados:**

* `src/hooks/useGlobalShortcut.js`
* `src/components/GalleryView.jsx`
* `src/components/CertificatesView.jsx`

ESLint identificó Hooks cuya lista de dependencias puede no representar correctamente los valores utilizados dentro del efecto.

### Impacto

**Confiabilidad:** El efecto puede utilizar información desactualizada o no ejecutarse cuando corresponde.

**Consistencia:** El comportamiento puede variar dependiendo de los cambios de estado o propiedades.

**Mantenibilidad:** Las dependencias incorrectas dificultan comprender qué elementos controlan el comportamiento del efecto.

### Evaluación

**Prioridad: Media.**

Cada `useEffect` debe revisarse individualmente. No se recomienda simplemente desactivar la regla.

---

## 4.3 Uso de `app.run()`

### Q-11 — Servidor de desarrollo de Flask

**Herramienta:** Semgrep OSS
**ID:** #39
**Archivo:** `backend/app.py:1433`

Semgrep detectó una configuración relacionada con `app.run()`.

### Impacto

**Confiabilidad:** El servidor de desarrollo de Flask no está diseñado para manejar cargas productivas.

**Seguridad:** Puede proporcionar un entorno menos apropiado para producción.

**Mantenibilidad:** Separar la aplicación del mecanismo de despliegue facilita administrar el sistema en diferentes entornos.

### Evaluación

**Prioridad: Media.**

Debe determinarse si `app.run()` se utiliza exclusivamente durante desarrollo. Si se utiliza en producción, debe reemplazarse por un servidor WSGI apropiado, como Gunicorn.

---

## 4.4 Vulnerabilidades que pueden provocar indisponibilidad

Los siguientes hallazgos también afectan la confiabilidad:

* Pillow — vulnerabilidades de DoS.
* CairoSVG — procesamiento de SVG malicioso.
* SheetJS — ReDoS.
* Pillow — procesamiento de PDF y fuentes.

Estos hallazgos deben considerarse conjuntamente porque un atacante podría provocar fallos o indisponibilidad del servicio mediante archivos especialmente diseñados.

---

# 5. Mantenibilidad

La mantenibilidad se refiere a la facilidad con la que el software puede comprenderse, modificarse y corregirse.

## 5.1 Variables no utilizadas

### Q-16 — Código innecesario

**Herramienta:** ESLint
**Regla:** `no-unused-vars`

**Archivos afectados:**

* `src/hooks/useTemplates.js`
* `src/components/UI.jsx`
* `src/components/ImportView.jsx`
* `src/components/CertificatesView.jsx`

ESLint identificó variables, parámetros o elementos declarados que no son utilizados.

### Impacto

**Mantenibilidad:** El código innecesario dificulta la lectura y comprensión.

**Consistencia:** Puede indicar que diferentes partes del código no siguen el mismo nivel de limpieza.

**Confiabilidad:** Puede ser indicativo de código incompleto o remanente de modificaciones anteriores.

### Evaluación

**Prioridad: Baja-Media.**

Se recomienda eliminar las variables que no tengan una función o determinar si representan funcionalidad pendiente.

---

## 5.2 Cadenas de formato dinámicas

### Q-13 — Uso de cadenas dinámicas

**Herramienta:** Semgrep OSS
**IDs:** #56 y #57
**Archivo:** `src/hooks/useTemplates.js:130`

Semgrep detectó una construcción dinámica de cadenas que puede ser problemática dependiendo del origen y uso de los valores.

### Impacto

**Mantenibilidad:** Las construcciones complejas pueden dificultar comprender el flujo de datos.

**Consistencia:** Debe verificarse que se utilicen patrones uniformes para construir cadenas.

### Evaluación

**Prioridad: Baja.**

Debe revisarse el contexto antes de considerarlo una vulnerabilidad.

---

## 5.3 Actualización de dependencias

Los hallazgos de Trivy también representan una oportunidad de mejora de mantenibilidad.

Mantener dependencias vulnerables aumenta la deuda técnica y dificulta mantener el sistema actualizado.

La estrategia recomendada es:

**Identificación → Actualización → Pruebas de regresión → Nuevo análisis Trivy → Verificación**

No se recomienda corregir cada alerta individualmente cuando varias pertenecen a la misma dependencia.

---

# 6. Consistencia

La consistencia evalúa si diferentes componentes del sistema siguen reglas y prácticas uniformes.

## 6.1 Rules of Hooks

### Q-14 — Incumplimiento de convenciones de React

El incumplimiento de `react-hooks/rules-of-hooks` representa una inconsistencia con las convenciones establecidas por React.

Además de afectar la confiabilidad, mantener componentes que utilizan los Hooks de manera diferente puede dificultar la comprensión uniforme del código.

**Impacto:** Alto.

---

## 6.2 Dependencias de Hooks

### Q-15 — Uso inconsistente de dependencias

Los hallazgos de `react-hooks/exhaustive-deps` pueden indicar que los componentes no siguen un criterio uniforme para definir las dependencias de sus efectos.

**Impacto:** Medio.

---

## 6.3 Variables no utilizadas

### Q-16 — Código no utilizado

La presencia de variables no utilizadas en diferentes componentes indica oportunidades de mejora en las prácticas de limpieza y organización del código.

**Impacto:** Bajo-Medio.

---

# 7. Rendimiento

Aunque la mayoría de los hallazgos no fueron diseñados específicamente como pruebas de rendimiento, algunos problemas identificados pueden afectar directamente el consumo de recursos.

## 7.1 Vulnerabilidades de Denial of Service

Los principales hallazgos relacionados con rendimiento son:

| Dependencia | Problema                       | Posible impacto              |
| ----------- | ------------------------------ | ---------------------------- |
| Pillow      | Procesamiento malicioso de PDF | Consumo excesivo de recursos |
| Pillow      | Procesamiento de fuentes       | Consumo excesivo de recursos |
| CairoSVG    | SVG malicioso                  | Indisponibilidad             |
| SheetJS     | ReDoS                          | Consumo elevado de CPU       |

Estos hallazgos deben considerarse simultáneamente desde **seguridad, confiabilidad y rendimiento**.

---

# 8. Evaluación consolidada por criterio de calidad

La siguiente tabla permite observar qué criterios son afectados por los diferentes grupos de hallazgos.

| Criterio           | Principales hallazgos                                                                                                                      | Herramientas           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| **Seguridad**      | Pillow, lxml, SheetJS, CairoSVG, DOMPurify, flask-cors, Flask, Docker root, SRI, `dangerouslySetInnerHTML`, URLs dinámicas, GitHub Actions | Trivy, Semgrep         |
| **Confiabilidad**  | Rules of Hooks, dependencias incorrectas en Hooks, `app.run()`, DoS, ReDoS, errores de procesamiento de archivos                           | ESLint, Semgrep, Trivy |
| **Mantenibilidad** | Variables no utilizadas, cadenas dinámicas, dependencias desactualizadas                                          | ESLint, Semgrep, Trivy |
| **Consistencia**   | Rules of Hooks, dependencias de Hooks, variables no utilizadas, prácticas inconsistentes de código                                         | ESLint                 |
| **Rendimiento**    | DoS, ReDoS y procesamiento costoso de archivos                                                                                             | Trivy                  |

---

# 9. Priorización general

Al considerar conjuntamente el impacto sobre los diferentes criterios de calidad, se recomienda la siguiente prioridad.

### 🔴 Prioridad alta

1. **Pillow**

   * Ejecución de código.
   * Inyección de comandos.
   * Corrupción de memoria.
   * Procesamiento de archivos potencialmente maliciosos.

2. **lxml**

   * Posible acceso a archivos locales mediante XML.

3. **SheetJS**

   * Prototype Pollution.
   * ReDoS.

4. **Contenedor Docker ejecutándose como root**

   * Privilegios innecesarios.
   * Mayor impacto ante una posible explotación.

5. **Incumplimiento de Rules of Hooks**

   * Posible afectación directa al comportamiento del frontend.

### 🟠 Prioridad media-alta

1. **`dangerouslySetInnerHTML`**

   * Especialmente si el contenido proviene de usuarios.

2. **URLs dinámicas**

   * Especialmente si pueden ser controladas por usuarios.

3. **CairoSVG**

   * Riesgo de DoS mediante SVG.

### 🟡 Prioridad media

1. **Dependencias incorrectas en Hooks.**
2. **flask-cors.**
3. **`app.run()` si se utiliza en producción.**
4. **DOMPurify.**

### 🟢 Prioridad baja

1. **Variables no utilizadas.**
2. **Cadenas de formato dinámicas.**
3. **SRI en archivos de documentación o mockups.**
4. **Vulnerabilidad de caché de sesiones de Flask**, dependiendo del uso real de sesiones.

---

# 10. Estrategia general de mejora

La corrección de los hallazgos debería realizarse considerando el criterio de calidad afectado y no únicamente la severidad asignada por cada herramienta.

Se recomienda el siguiente flujo:

```text
Identificación de hallazgo
          ↓
Clasificación por criterio de calidad
          ↓
Análisis contextual
          ↓
Priorización según impacto
          ↓
Corrección
          ↓
Pruebas funcionales y de regresión
          ↓
Nuevo análisis automatizado
          ↓
Verificación de los resultados
```

Para las dependencias vulnerables, el proceso recomendado es:

```text
Trivy
  ↓
Identificar dependencia vulnerable
  ↓
Actualizar dependencia
  ↓
Ejecutar pruebas
  ↓
Ejecutar Trivy nuevamente
  ↓
Verificar GitHub Code Security
```

Para el código fuente:

```text
ESLint / Semgrep
       ↓
Revisar contexto del hallazgo
       ↓
Determinar impacto real
       ↓
Corregir código
       ↓
Ejecutar pruebas
       ↓
Volver a ejecutar análisis estático
```

---

# 11. Conclusión

Los análisis realizados mediante Trivy, Semgrep OSS y ESLint permitieron evaluar diferentes dimensiones de la calidad del software.

Los resultados muestran que los problemas de **seguridad** representan el grupo de mayor impacto, principalmente debido a las vulnerabilidades encontradas en dependencias como Pillow, lxml y SheetJS, así como a configuraciones y patrones de código potencialmente inseguros detectados por Semgrep.

En cuanto a la **confiabilidad**, los hallazgos relacionados con React Hooks, el procesamiento de archivos y las condiciones de Denial of Service representan los problemas más relevantes. Estos pueden provocar comportamientos inesperados, errores durante la ejecución o incluso indisponibilidad del sistema.

La **mantenibilidad** se ve afectada principalmente por código no utilizado, construcciones que requieren revisión y la presencia de dependencias vulnerables que incrementan la deuda técnica del proyecto.

Por su parte, la **consistencia** se relaciona principalmente con el cumplimiento de convenciones de desarrollo. Los hallazgos de ESLint muestran que existen componentes que no siguen de manera uniforme las reglas establecidas para React Hooks y la limpieza del código.

Finalmente, algunos hallazgos también tienen impacto sobre el **rendimiento**, particularmente aquellos relacionados con Denial of Service y ReDoS.

Por lo tanto, los resultados de las herramientas de análisis estático no deben interpretarse únicamente como una lista de vulnerabilidades. En conjunto, permiten obtener una visión más amplia de la calidad del software al identificar problemas que afectan diferentes atributos del sistema. La evaluación final debe considerar tanto la severidad proporcionada por las herramientas como el contexto de cada hallazgo, su posibilidad real de explotación y el impacto que tendría sobre el funcionamiento y mantenimiento del software.

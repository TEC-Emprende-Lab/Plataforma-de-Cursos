# Revisión técnica general

## Hallazgos

### [Media] Los recordatorios no reciben la información de los cursos

**Ubicación:**

- `src/components/RemindersView.jsx`, líneas 11-36.
- `src/components/AccessView.jsx`, línea 56.
- `src/components/ProfileView.jsx`, línea 188.
- `src/utils/email.js`, líneas 9-45.

**Qué ocurre:** `buildReminderEmail()` y `openEmailClient()` pueden recibir la lista de cursos, pero las vistas les envían solamente el participante. Cuando la lista no se proporciona, la utilidad utiliza los IDs internos de los cursos y calcula las fechas con el período general.

**Impacto:** El asunto y el cuerpo del correo pueden mostrar un UUID o código interno en lugar del nombre del curso. Si el curso tiene una duración distinta de 45 días, las fechas indicadas en el correo tampoco coinciden con la vigencia mostrada en la aplicación.

**Procedimiento de comprobación:**

1. Seleccionar o crear un curso con una duración distinta de 45 días.
2. Asignar un participante y configurar su fecha para que aparezca en **Recordatorios**.
3. Abrir la vista previa del correo.
4. Revisar el nombre del curso y las fechas del mensaje.

**Resultado que confirma el error:** El correo muestra el identificador interno del curso o fechas diferentes a las mostradas en Control de Accesos.

**Posible mejora:** Pasar `courses` a `buildReminderEmail()`, `copyEmailToClipboard()` y `openEmailClient()`, y usar los días resueltos para el participante al calcular las fechas.

---

### [Media] Un participante sin acceso puede aparecer como expirado

**Ubicación:**

- `src/components/AccessView.jsx`, línea 10.
- `src/components/ParticipantsView.jsx`, líneas 149-150.

**Qué ocurre:** La lista de expirados y los filtros por vencimiento revisan únicamente la fecha. No comprueban primero si `participant.access` está activo.

**Impacto:** Una persona configurada como **Sin acceso** puede aparecer en el bloque de accesos expirados y recibir la acción **Renovar**. En la lista de participantes también puede aparecer bajo los filtros de expirado o por vencer.

**Procedimiento de comprobación:**

1. Crear un participante con **Acceso: Sin acceso**.
2. Establecer una fecha de ingreso de más de 45 días de antigüedad.
3. Guardar el registro y abrir **Control de Accesos**.
4. Abrir **Participantes** y aplicar el filtro de expirados.

**Resultado que confirma el error:** El participante aparece como expirado aunque su estado sea **Sin acceso**.

**Posible mejora:** Exigir `p.access` al construir las listas y filtros de expirados o por vencer.

---

### [Media] El modo local permite crear participantes con el mismo correo

**Ubicación:**

- `src/components/ParticipantModal.jsx`, líneas 43-55.
- `src/hooks/useParticipants.js`, líneas 121-139.

**Qué ocurre:** Antes de guardar un participante no se comprueba si ya existe otro con el mismo correo. En modo local tampoco existe la restricción única que tiene la tabla de Supabase.

**Impacto:** Se pueden crear dos o más participantes con el mismo correo, lo cual vuelve ambiguas las búsquedas, importaciones y comunicaciones.

**Procedimiento de comprobación:**

1. Copiar el correo de un participante existente.
2. Crear otro participante con el mismo correo.
3. Guardar el registro y localizar ambos participantes en la lista.

**Resultado que confirma el error:** Los dos participantes quedan registrados y visibles con el mismo correo. Este comportamiento fue confirmado manualmente durante la revisión.

**Posible mejora:** Comprobar el correo contra la lista actual antes de guardar y aplicar la misma regla en ambos modos de persistencia.

---

### [Media] El formulario permite guardar correo y teléfono con formatos inválidos

**Ubicación:** `src/components/ParticipantModal.jsx`, líneas 43-55 y 90-98.

**Qué ocurre:** La validación solo comprueba que el nombre y el correo no estén vacíos. No verifica el formato del correo ni el contenido del teléfono. Aunque el correo usa `type="email"`, el guardado se ejecuta mediante un botón normal y no mediante el envío validado de un formulario HTML.

**Impacto:** Se pueden guardar correos que no sirven para comunicaciones y teléfonos que contienen letras u otros valores inesperados. Esto reduce la calidad de los datos y afecta búsquedas y recordatorios.

**Procedimiento de comprobación:**

1. Abrir **Nuevo participante**.
2. Introducir un nombre válido.
3. Introducir `correo-invalido` en el campo de correo.
4. Introducir `telefonoABC` en el campo de teléfono.
5. Presionar **Guardar**.

**Resultado que confirma el error:** El modal se cierra y el participante queda registrado con ambos valores inválidos. Durante la revisión se confirmó manualmente que la aplicación aceptó un correo sin `@` y un teléfono alfanumérico sin mostrar ninguna advertencia.

**Posible mejora:** Validar explícitamente el correo y el teléfono antes de ejecutar `onSave()`, además de manejar el guardado mediante un elemento `<form>` para aprovechar la validación nativa del navegador.

---

### [Baja] Una etiqueta puede guardarse sin nombre

**Ubicación:**

- `src/components/TagsView.jsx`, líneas 21-22 y 118-127.
- `src/hooks/useTags.js`, líneas 51-60.

**Qué ocurre:** La creación de etiquetas exige texto, pero la edición no valida ni aplica `trim()` al nombre antes de guardar.

**Impacto:** Puede quedar una tarjeta o etiqueta visualmente vacía y difícil de identificar o volver a editar.

**Procedimiento de comprobación:**

1. Abrir **Etiquetas**.
2. Editar una etiqueta existente.
3. Eliminar completamente su nombre.
4. Presionar **Guardar**.

**Resultado que confirma el error:** La etiqueta se guarda sin texto visible.

**Posible mejora:** Reutilizar la misma validación de nombre no vacío empleada al crear etiquetas.

---

### [Media] La vista previa de exportación superpone el correo y los cursos

**Ubicación:**

- `src/components/ExportView.jsx`, líneas 109-129.
- `src/styles/global.css`, líneas 289-300.

**Qué ocurre:** La vista previa utiliza la clase general `.ttable`, que aplica `table-layout: fixed`. La tabla reparte el espacio disponible entre cinco columnas, pero las celdas de correo y cursos no tienen reglas para cortar, envolver o truncar contenido largo. Como resultado, el texto de una columna invade visualmente la siguiente.

**Impacto:** Los correos y nombres de cursos se mezclan y dejan de leerse con claridad. Esto hace que la vista previa no permita comprobar de forma confiable qué información se va a exportar.

**Procedimiento de comprobación:**

1. Abrir **Exportar datos** con participantes que tengan correos largos y cursos asignados.
2. Observar las columnas **Correo** y **Cursos** de la vista previa.
3. Cambiar el ancho de la ventana para comprobar el comportamiento de la tabla.

**Resultado que confirma el error:** El correo se superpone con el nombre del curso, tal como se observó en el pantallazo tomado durante la revisión.

**Posible mejora:** Definir anchos apropiados para las columnas y aplicar una estrategia consistente para contenido largo, como salto de línea, `overflow-wrap` o truncamiento con puntos suspensivos. La corrección debe comprobarse en escritorio y en los puntos de quiebre responsivos existentes.

## Orden sugerido para comprobarlos

1. Etiqueta sin nombre.
2. Correo y teléfono inválidos.
3. Participante sin acceso mostrado como expirado.
4. Participante duplicado por correo.
5. Contenido incorrecto del correo recordatorio.
6. Superposición de columnas en la vista previa de exportación.

Todas las pruebas se pueden realizar desde la interfaz local sin simular fallos de red. Después de comprobar cada caso, conviene eliminar los registros utilizados para la prueba.

## Recomendación general: incorporar integración continua

Actualmente no existe un workflow en `.github/workflows`. Se recomienda incorporar un pipeline de **integración continua (CI)** con GitHub Actions para revisar automáticamente cada pull request y cada cambio dirigido a la rama principal.

El workflow deberá ejecutar las verificaciones de calidad definidas en `NOTES.MD`, evitando duplicar en este documento la selección de herramientas y tipos de prueba. Como controles adicionales propios del pipeline, se recomienda comprobar la construcción del frontend y la construcción de `backend/Dockerfile`, sin publicar la imagen resultante.

Las verificaciones deberán configurarse como requisito para integrar cambios en `main`. Esta protección permitirá bloquear el merge de cambios que no superen el pipeline, aunque los commits continúen disponibles en sus ramas de origen.

No se recomienda incorporar despliegue continuo en esta etapa. Vercel y Render ya gestionan el alojamiento de sus respectivas partes, y el alcance propuesto se limita a validar los cambios sin desplegarlos. El workflow tampoco deberá utilizar credenciales reales ni escribir en servicios de producción.

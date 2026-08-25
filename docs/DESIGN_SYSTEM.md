# Sistema de Diseño — TEC Emprende Lab

Línea gráfica y reglas de diseño usadas en la **Plataforma de Cursos**.
Documento pensado para **reutilizarse en otros proyectos** de la marca.

> Estilo: cálido, institucional, limpio y accesible (WCAG 2.2 AA).
> Stack de referencia: React 18 + Vite + CSS variables (tokens).

---

## 1. Identidad de marca

- **Color principal:** naranja-rojo institucional `#E8521A`.
- **Tono general:** paleta cálida (crema / arena / oliva), evitando blanco puro y negro puro.
- **Tipografía única:** **Poppins** (display y cuerpo).
- **Logo:** wordmark "TEC EMPRENDE Lab" monocromático que se recolorea por tema
  (naranja en claro, blanco en oscuro).

---

## 2. Paleta de color (design tokens)

Se trabaja con **variables CSS** (`--token`), no colores hardcodeados. Esto permite
el modo oscuro y mantener consistencia.

### Modo claro

| Token | Hex | Uso |
|-------|-----|-----|
| `--cream` | `#FAF5EC` | Fondo principal (blanco arenoso) |
| `--cream-2` | `#F2E8D0` | Filas alternas, hover, inputs |
| `--cream-3` | `#E8D8B4` | Profundidad, separadores |
| `--white` | `#FFFFFF` | Superficie de tarjetas |
| `--orange` | `#E8521A` | **Acento / acción primaria** |
| `--orange-l` | `#F07040` | Naranja claro (hover, detalles) |
| `--orange-d` | `#A84020` | Siena — error / expirado |
| `--black` | `#1A1612` | Texto principal, sidebar |
| `--black-2` | `#2E2820` | Texto/superficie secundaria |
| `--gray` | `#6E6553` | Texto secundario (contraste AA sobre crema) |
| `--border` | `#CEBF98` | Bordes tono arena |
| `--green` | `#6E7530` | Oliva — éxito / activo |
| `--green-l` | `#EAF0D0` | Oliva claro (fondos de éxito) |
| `--blue` | `#8098C8` | Lavanda — info / IA |
| `--blue-l` | `#EEF3FF` | Lavanda claro |

### Modo oscuro (overrides)

| Token | Hex | Nota |
|-------|-----|------|
| `--cream` | `#19160F` | Fondo oscuro con tinte oliva (NO negro puro) |
| `--cream-2` | `#241F16` | |
| `--cream-3` | `#2E2818` | |
| `--white` | `#1E1A12` | Superficie de cards |
| `--border` | `#3A3220` | |
| `--black` | `#FAF5EC` | Texto (invertido) |
| `--gray` | `#9C9485` | Texto secundario |
| `--orange` | `#ED7B4F` | **Acento desaturado** para que no "vibre" en oscuro |
| `--orange-l` | `#F49A75` | |
| `--orange-d` | `#D9612F` | |

### Tokens semánticos (independientes del tema)

| Token | Valor | Uso |
|-------|-------|-----|
| `--sidebar-bg` | oscuro siempre (`#1A1612` / `#0D0B06`) | Fondo de la barra lateral |
| `--sidebar-text` | crema | Texto principal del sidebar |
| `--sidebar-muted` | `#B3A892` | Texto secundario del sidebar (AA sobre fondo oscuro) |
| `--sidebar-border` | `#3A332B` | Bordes internos del sidebar |
| `--logo-color` | naranja (claro) / `#FFFFFF` (oscuro) | Color del wordmark |
| `--shadow-card` | `0 1px 2px rgba(26,22,18,.04)` | Sombra suave de tarjetas |

---

## 3. La regla 60-30-10

- **60% dominante:** fondos crema (`--cream`). Reflejan menos luz que el blanco puro → menos fatiga.
- **30% estructura:** sidebar oscuro, tarjetas blancas, textos.
- **10% acento:** naranja **solo** en acciones primarias y estados activos.

**Consistencia funcional:** el naranja = "acción/seleccionado". No usarlo para texto informativo común.

---

## 4. Tipografía

- **Fuente única:** Poppins (sans-serif), pesos 400–800.
- **Tokens:** `--font-display`, `--font-body` (ambos Poppins), `--font-mono` (Courier New para códigos/IDs).
- **Escala usada:**

| Rol | Tamaño / peso | Uso |
|-----|----------------|-----|
| Título de página (`.h1`) | ~22px / 600 | Encabezado de cada vista |
| Subtítulo de sección (`.h3`) | ~16-18px / 600 | Bloques dentro de una vista |
| Cuerpo | 13–14px / 400 | Texto general |
| Etiqueta/caps | 10–11px / 600–700, `letter-spacing .5–.6px`, MAYÚSCULA | Labels de campos y secciones |
| Métrica grande | 22–28px / 700 | Números de StatCards |

- **Líneas de texto:** `line-height` 1.5–1.6; bloques alineados a la **izquierda** (no justificar).

---

## 5. Espaciado, radios y elevación

- **Radios:** `--radius-sm 6px`, `--radius-md 8px`, `--radius-lg 12px`, `--radius-xl 16px`.
- **Gaps típicos:** 8 / 12 / 14 / 16 / 20 px.
- **Tarjetas:** fondo `--white`, borde `--border`, radio `--radius-lg`, sombra `--shadow-card`.
- **Transición de tema:** 0.35s en `background-color`, `color`, `border-color`, `fill`
  (respeta `prefers-reduced-motion`).

---

## 6. Componentes base

| Componente | Regla |
|------------|-------|
| **Botón primario** (`.btn.btn-orange`) | Fondo naranja, texto blanco. Solo para la acción principal. |
| **Botón secundario** (`.btn.btn-ghost`) | Transparente, borde arena. Acciones secundarias. |
| **Botón oscuro** (`.btn.btn-black`) | Negro/crema, acciones alternativas. |
| **Input** (`.finput`) | Fondo crema-2, borde arena, foco naranja. |
| **StatCard** | Número grande + etiqueta; acento de color opcional (naranja/siena/oliva). |
| **Tabla** (`.ttable`) | Encabezado en MAYÚSCULA tono gris, filas alternas crema. Responsiva → tarjetas en móvil. |
| **Badge / pill** | `inline-flex`, radio 20px, fondos suaves por estado. |
| **TagPill** | Punto de color + texto. |
| **AccessBar** | Muestra días transcurridos de total (ej: `12d de 45d`), no porcentaje. Colores semánticos por estado. |
| **ColorPicker** | Selector de color con fondo `cream-3` y borde para distinguir colores claros del fondo. Accesible: `role="radiogroup"`, botones con `role="radio"`. |
| **Barra de progreso** (`.pbar`) | Verde (ok) / naranja (warn) / siena (expirado). |

### Patrones de layout recurrentes
- **Bento / grilla de tarjetas:** `grid` con `repeat(auto-fill, minmax(Npx, 1fr))`.
- **Card destacada:** borde superior de color (ej: `borderTop: 3px solid var(--orange)`) para acciones primarias dentro de una vista con múltiples cards.
- **Shell:** sidebar fijo oscuro (220px) + contenido crema con padding generoso.
- **Wizard por pasos:** stepper numerado (1→2→3) con verificación por paso.
- **Pestañas:** subnavegación con contador por pestaña.

---

## 7. Accesibilidad (reglas obligatorias)

Estándar objetivo: **WCAG 2.2 AA**.

1. **Contraste:** texto normal ≥ 4.5:1; texto grande / iconos ≥ 3:1. Los grises se
   ajustan por superficie (`--gray` para crema, `--sidebar-muted` para el sidebar oscuro).
2. **Color + forma:** nunca transmitir estado solo con color. Acompañar con **ícono + texto**
   (ej. estados de acceso: 🔒 Sin acceso · ⊘ Expirado · 🕐 Por vencer · ✓ Vigente).
3. **Foco visible:** anillo naranja (`outline: 2px solid var(--orange); outline-offset: 2px`)
   en `:focus-visible` de todo elemento interactivo. Nunca quitar el outline sin reemplazo.
4. **Skip-to-content:** enlace oculto que aparece al tabular y salta a `<main id="main-content">`.
5. **Teclado:** todo accionable es `<button>`/`<a>` real (o `role="button"` + `tabIndex` + Enter/Espacio).
   Modales cierran con `Esc`, atrapan el foco y lo restauran al disparador.
6. **Formularios:** `<label htmlFor>` + `aria-invalid` + `aria-describedby` ligando el mensaje de error.
7. **Landmarks:** `<nav aria-label>`, `<main>`, `<aside>`; íconos decorativos con `aria-hidden="true"`.
8. **Modo oscuro real:** sin negro puro (`#19160F`), acento naranja desaturado.
9. **Movimiento:** respetar `prefers-reduced-motion` (desactivar transiciones/animaciones).

---

## 8. Colores semánticos (convención universal)

| Significado | Color | Token |
|-------------|-------|-------|
| Éxito / activo / vigente | Verde oliva | `--green` |
| Acción / advertencia leve / seleccionado | Naranja | `--orange` |
| Error / expirado / peligro | Siena | `--orange-d` |
| Info / IA | Lavanda | `--blue` |
| Neutro / deshabilitado | Gris cálido | `--gray` |

---

## 9. Cómo portar a otro proyecto

1. Copiar el bloque `:root` y `[data-theme="dark"]` de tokens (sección 2) al CSS global.
2. Cargar **Poppins** (Google Fonts) y los íconos (Material Symbols / Tabler).
3. Aplicar la regla 60-30-10 y los colores semánticos.
4. Implementar el set de accesibilidad de la sección 7 desde el inicio (no como parche).
5. Reusar los patrones: shell con sidebar oscuro, tarjetas, StatCards, tablas responsivas,
   wizard por pasos y pestañas con contador.

> Mantener **una sola fuente de verdad** para el color: tokens CSS, nunca hex hardcodeado
> en componentes (excepto utilidades muy puntuales).

// ============================================================
// templatesLocalAdapter.js — Persistencia local de plantillas
// SVG.
//
// En modo local las plantillas se mantienen en memoria durante
// la sesión actual.
//
// Las plantillas integradas (built-in) se cargan desde los
// archivos SVG públicos de la aplicación.
//
// Mantiene la misma API que el adapter de Supabase.
//
// Operaciones:
//   list()
//   loadContent(template)
//   upload(file, meta)
//   remove(id)
//
// Contrato:
//   Éxito con entidad:
//     return entity
//
//   Éxito sin entidad natural:
//     return { id, deleted: true }
//
//   Error:
//     return { error: { message, code } }
// ============================================================

import { sanitizeSvg } from '../../utils/svg.js'

// ============================================================
// Plantillas integradas
// ============================================================

const BUILTIN_TEMPLATES = [
  {
    id: 'builtin-classic',
    name: 'Clásico Dorado',
    file_name: 'template_classic.svg',
    style: 'Institucional',
    course: 'Todos los programas',
    colors: ['#C9A227', '#8B1A1A', '#2C1810'],
    tags: [
      'horizontal',
      'clásico',
      'dorado',
      'institucional',
    ],
    name_id: 'recipient_name',
    date_id: 'issue_date',
    is_builtin: true,
    created_at: '2026-01-10',
  },
  {
    id: 'builtin-modern',
    name: 'Moderno Oscuro',
    file_name: 'template_modern.svg',
    style: 'Contemporáneo',
    course: 'Todos los programas',
    colors: ['#0D1B2A', '#00C9FF', '#92FE9D'],
    tags: [
      'horizontal',
      'moderno',
      'oscuro',
      'tech',
    ],
    name_id: 'recipient_name',
    date_id: 'issue_date',
    is_builtin: true,
    created_at: '2026-01-10',
  },
]

// ============================================================
// Helpers
// ============================================================

function createError(message, code) {
  return {
    error: {
      message,
      code,
    },
  }
}

// ============================================================
// Adapter
// ============================================================

export function createTemplatesLocalAdapter() {

  let templates =
    BUILTIN_TEMPLATES.map(template => ({
      ...template,
      svgContent: null,
    }))

  return {

    // --------------------------------------------------------
    // Listar plantillas
    // --------------------------------------------------------

    async list() {
      return [...templates]
    },

    // --------------------------------------------------------
    // Cargar contenido SVG
    // --------------------------------------------------------

    async loadContent(template) {

      if (!template) {
        return createError(
          'No se proporcionó una plantilla.',
          'TEMPLATE_REQUIRED'
        )
      }

      if (template.svgContent) {
        return sanitizeSvg(
          template.svgContent
        )
      }

      if (!template.is_builtin) {
        return createError(
          'La plantilla no contiene contenido SVG.',
          'SVG_CONTENT_NOT_FOUND'
        )
      }

      try {
        const response = await fetch(
          `/templates/${template.file_name}`
        )

        if (!response.ok) {
          console.warn(
            `[templatesLocalAdapter] fetch ${response.status} for ${template.file_name}`
          )

          return createError(
            'No se pudo cargar el contenido de la plantilla.',
            'TEMPLATE_CONTENT_LOAD_ERROR'
          )
        }

        const svgText =
          await response.text()

        const sanitized =
          sanitizeSvg(svgText)

        if (!sanitized) {
          return createError(
            'La plantilla no contiene un SVG válido.',
            'INVALID_SVG_CONTENT'
          )
        }

        return sanitized

      } catch (error) {
        console.warn(
          `[templatesLocalAdapter] preview error for ${template.file_name}`,
          error
        )

        return createError(
          error?.message ||
            'No se pudo cargar el contenido de la plantilla.',
          'TEMPLATE_CONTENT_LOAD_ERROR'
        )
      }
    },

    // --------------------------------------------------------
    // Subir plantilla
    // --------------------------------------------------------

    async upload(file, meta = {}) {

      let svgText

      try {
        svgText = sanitizeSvg(
          await file.text()
        )
      } catch (error) {
        console.error(
          '[templatesLocalAdapter] upload',
          error
        )

        return createError(
          error?.message ||
            'No se pudo leer el archivo SVG.',
          'SVG_READ_ERROR'
        )
      }

      if (!svgText) {
        return createError(
          'El archivo no contiene un SVG válido.',
          'INVALID_SVG_FILE'
        )
      }

      const safeFile = new File(
        [svgText],
        file.name,
        {
          type: 'image/svg+xml',
        }
      )

      const newTemplate = {
        id: `local-${Date.now()}`,

        name:
          meta.name ||
          file.name
            .replace('.svg', '')
            .replace(/[-_]/g, ' '),

        file_name: file.name,

        style:
          meta.style ||
          'Personalizado',

        course:
          meta.course ||
          'Todos los programas',

        colors:
          meta.colors ||
          ['#666666'],

        tags:
          meta.tags ||
          [
            'personalizado',
            'subido',
          ],

        name_id:
          meta.name_id ||
          'recipient_name',

        date_id:
          meta.date_id ||
          'issue_date',

        storage_path: null,

        is_builtin: false,

        created_at:
          new Date()
            .toISOString()
            .split('T')[0],

        svgContent: svgText,

        _file: safeFile,
      }

      templates = [
        ...templates,
        newTemplate,
      ]

      return newTemplate
    },

    // --------------------------------------------------------
    // Eliminar plantilla
    // --------------------------------------------------------

    async remove(id) {

      const exists =
        templates.some(
          template =>
            template.id === id
        )

      if (!exists) {
        return createError(
          'La plantilla no existe.',
          'TEMPLATE_NOT_FOUND'
        )
      }

      const template =
        templates.find(
          template =>
            template.id === id
        )

      if (template?.is_builtin) {
        return createError(
          'Las plantillas integradas no se pueden eliminar.',
          'BUILTIN_TEMPLATE'
        )
      }

      templates =
        templates.filter(
          template =>
            template.id !== id
        )

      return {
        id,
        deleted: true,
      }
    },
  }
}
// ============================================================
// templatesAdapter.js — Persistencia de plantillas mediante
// Supabase / Certificate API.
//
// En modo Supabase, la información de las plantillas se obtiene
// desde Supabase y las operaciones de archivos se realizan
// mediante la Certificate API.
//
// Las plantillas integradas (built-in) se mantienen como
// metadatos locales y su contenido SVG se obtiene desde los
// archivos públicos de la aplicación.
//
// Mantiene la misma API que el adapter local.
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

import { supabase } from '../../lib/supabase.js'
import { CERT_API } from '../../config.js'
import { certificateApiFetch } from '../../lib/certificateApi.js'
import { sanitizeSvg } from '../../utils/svg.js'

const BUCKET = 'certificate-templates'

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
    colors: [
      '#C9A227',
      '#8B1A1A',
      '#2C1810',
    ],
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
    colors: [
      '#0D1B2A',
      '#00C9FF',
      '#92FE9D',
    ],
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

function fromSupabaseError(error, fallbackCode) {
  return {
    error: {
      message:
        error?.message ??
        'Ocurrió un error en Supabase.',
      code:
        error?.code ??
        fallbackCode,
    },
  }
}

function createError(message, code) {
  return {
    error: {
      message,
      code,
    },
  }
}

function fromDb(row) {
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    file_name: row.file_name,
    style:
      row.style ??
      'Personalizado',
    course:
      row.course ??
      'Todos los programas',
    colors:
      row.colors ??
      ['#666666'],
    tags:
      row.tags ??
      ['personalizado'],
    name_id:
      row.name_id ??
      'recipient_name',
    date_id:
      row.date_id ??
      'issue_date',
    storage_path:
      row.storage_path ??
      null,
    is_builtin:
      row.is_builtin ??
      false,
    created_at:
      row.created_at ??
      '',
    svgContent: null,
  }
}

// ============================================================
// Adapter
// ============================================================

export function createTemplatesSupabaseAdapter() {

  return {

    // --------------------------------------------------------
    // Listar plantillas
    // --------------------------------------------------------

    async list() {
      const { data, error } =
        await supabase
          .from('svg_templates')
          .select('*')
          .eq('is_builtin', false)
          .order(
            'created_at',
            {
              ascending: false,
            }
          )

      if (error) {
        return fromSupabaseError(
          error,
          'TEMPLATES_LOAD_ERROR'
        )
      }

      return [
        ...BUILTIN_TEMPLATES.map(
          template => ({
            ...template,
            svgContent: null,
          })
        ),

        ...(data || []).map(fromDb),
      ]
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
        const sanitized =
          sanitizeSvg(
            template.svgContent
          )

        if (!sanitized) {
          return createError(
            'El contenido SVG no es válido.',
            'INVALID_SVG_CONTENT'
          )
        }

        return sanitized
      }

      // ------------------------------------------------------
      // Built-in
      // ------------------------------------------------------

      if (template.is_builtin) {
        try {
          const response =
            await fetch(
              `/templates/${template.file_name}`
            )

          if (!response.ok) {
            return createError(
              'No se pudo cargar el contenido de la plantilla.',
              'TEMPLATE_CONTENT_LOAD_ERROR'
            )
          }

          const sanitized =
            sanitizeSvg(
              await response.text()
            )

          if (!sanitized) {
            return createError(
              'El contenido SVG no es válido.',
              'INVALID_SVG_CONTENT'
            )
          }

          return sanitized

        } catch (error) {
          console.warn(
            '[templatesSupabaseAdapter] builtin preview error',
            error
          )

          return createError(
            error?.message ||
              'No se pudo cargar el contenido de la plantilla.',
            'TEMPLATE_CONTENT_LOAD_ERROR'
          )
        }
      }

      // ------------------------------------------------------
      // Custom
      // ------------------------------------------------------

      if (!template.storage_path) {
        return createError(
          'La plantilla no tiene una ubicación de almacenamiento.',
          'TEMPLATE_STORAGE_PATH_MISSING'
        )
      }

      try {
        const { data } =
          supabase.storage
            .from(BUCKET)
            .getPublicUrl(
              template.storage_path
            )

        if (!data?.publicUrl) {
          return createError(
            'No se pudo obtener la URL de la plantilla.',
            'TEMPLATE_URL_ERROR'
          )
        }

        const response =
          await fetch(
            data.publicUrl
          )

        if (!response.ok) {
          return createError(
            'No se pudo cargar el contenido de la plantilla.',
            'TEMPLATE_CONTENT_LOAD_ERROR'
          )
        }

        const sanitized =
          sanitizeSvg(
            await response.text()
          )

        if (!sanitized) {
          return createError(
            'El contenido SVG no es válido.',
            'INVALID_SVG_CONTENT'
          )
        }

        return sanitized

      } catch (error) {
        console.warn(
          '[templatesSupabaseAdapter] custom preview error',
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

      // ------------------------------------------------------
      // Leer y sanitizar SVG
      // ------------------------------------------------------

      let svgText

      try {
        svgText =
          sanitizeSvg(
            await file.text()
          )
      } catch (error) {
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

      // ------------------------------------------------------
      // Analizar SVG
      // ------------------------------------------------------

      let analyzeResponse

      try {
        const analyzeForm =
          new FormData()

        analyzeForm.append(
          'file',
          safeFile
        )

        analyzeResponse =
          await certificateApiFetch(
            `${CERT_API}/api/analyze`,
            {
              method: 'POST',
              body: analyzeForm,
            }
          )
      } catch (error) {
        return createError(
          error?.message ||
            'No se pudo analizar la plantilla SVG.',
          'SVG_ANALYZE_ERROR'
        )
      }

      if (!analyzeResponse.ok) {
        const body =
          await analyzeResponse
            .json()
            .catch(() => ({}))

        return createError(
          body.error ||
            'El backend rechazó la plantilla SVG.',
          'SVG_ANALYZE_ERROR'
        )
      }

      const analyzeBody =
        await analyzeResponse
          .json()
          .catch(() => null)

      if (!analyzeBody) {
        return createError(
          'El backend devolvió una respuesta inválida.',
          'SVG_ANALYZE_RESPONSE_ERROR'
        )
      }

      const {
        elements = [],
      } = analyzeBody

      let name_id =
        'recipient_name'

      let date_id =
        'issue_date'

      const nameElement =
        elements.find(e =>
          /name|nombre|participante/i
            .test(e.id)
        ) || elements[0]

      const dateElement =
        elements.find(e =>
          /date|fecha/i
            .test(e.id)
        ) ||
        elements[1] ||
        elements[0]

      if (nameElement) {
        name_id = nameElement.id
      }

      if (dateElement) {
        date_id = dateElement.id
      }

      // ------------------------------------------------------
      // Preparar upload
      // ------------------------------------------------------

      const form =
        new FormData()

      form.append(
        'file',
        safeFile
      )

      form.append(
        'name',
        meta.name ||
          file.name.replace(
            '.svg',
            ''
          )
      )

      form.append(
        'style',
        meta.style ||
          'Personalizado'
      )

      form.append(
        'course',
        meta.course ||
          'Todos los programas'
      )

      form.append(
        'name_id',
        name_id
      )

      form.append(
        'date_id',
        date_id
      )

      form.append(
        'colors',
        JSON.stringify(
          meta.colors ||
            ['#666666']
        )
      )

      form.append(
        'tags',
        JSON.stringify(
          meta.tags || [
            'personalizado',
            'subido',
          ]
        )
      )

      // ------------------------------------------------------
      // Guardar mediante Certificate API
      // ------------------------------------------------------

      let response

      try {
        response =
          await certificateApiFetch(
            `${CERT_API}/api/templates/upload`,
            {
              method: 'POST',
              body: form,
            }
          )
      } catch (error) {
        return createError(
          error?.message ||
            'No se pudo guardar la plantilla.',
          'TEMPLATE_UPLOAD_ERROR'
        )
      }

      const body =
        await response
          .json()
          .catch(() => ({}))

      if (!response.ok) {
        return createError(
          body.error ||
            'No se pudo guardar la plantilla.',
          'TEMPLATE_UPLOAD_ERROR'
        )
      }

      if (!body?.template) {
        return createError(
          'El backend no devolvió la plantilla creada.',
          'TEMPLATE_UPLOAD_RESPONSE_ERROR'
        )
      }

      return {
        ...fromDb(body.template),
        svgContent: svgText,
      }
    },

    // --------------------------------------------------------
    // Eliminar plantilla
    // --------------------------------------------------------

    async remove(id) {

      // ------------------------------------------------------
      // Built-in
      // ------------------------------------------------------

      const builtin =
        BUILTIN_TEMPLATES.some(
          template =>
            template.id === id
        )

      if (builtin) {
        return createError(
          'Las plantillas integradas no se pueden eliminar.',
          'BUILTIN_TEMPLATE'
        )
      }

      // ------------------------------------------------------
      // Eliminar mediante API
      // ------------------------------------------------------

      let response

      try {
        response =
          await certificateApiFetch(
            `${CERT_API}/api/templates/delete`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                id,
              }),
            }
          )
      } catch (error) {
        return createError(
          error?.message ||
            'No se pudo eliminar la plantilla.',
          'TEMPLATE_DELETE_ERROR'
        )
      }

      const body =
        await response
          .json()
          .catch(() => ({}))

      if (!response.ok) {
        return createError(
          body.error ||
            'No se pudo eliminar la plantilla.',
          'TEMPLATE_DELETE_ERROR'
        )
      }

      return {
        id,
        deleted: true,
      }
    },
  }
}
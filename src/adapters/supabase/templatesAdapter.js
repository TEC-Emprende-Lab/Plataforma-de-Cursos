import { supabase } from '../../lib/supabase.js'
import { CERT_API } from '../../config.js'
import { certificateApiFetch } from '../../lib/certificateApi.js'
import { sanitizeSvg } from '../../utils/svg.js'

const BUCKET = 'certificate-templates'

const BUILTIN_TEMPLATES = [
  {
    id: 'builtin-classic',
    name: 'Clásico Dorado',
    file_name: 'template_classic.svg',
    style: 'Institucional',
    course: 'Todos los programas',
    colors: ['#C9A227', '#8B1A1A', '#2C1810'],
    tags: ['horizontal', 'clásico', 'dorado', 'institucional'],
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
    tags: ['horizontal', 'moderno', 'oscuro', 'tech'],
    name_id: 'recipient_name',
    date_id: 'issue_date',
    is_builtin: true,
    created_at: '2026-01-10',
  },
]

function fromDb(row) {
  return {
    id: row.id,
    name: row.name,
    file_name: row.file_name,
    style: row.style ?? 'Personalizado',
    course: row.course ?? 'Todos los programas',
    colors: row.colors ?? ['#666666'],
    tags: row.tags ?? ['personalizado'],
    name_id: row.name_id ?? 'recipient_name',
    date_id: row.date_id ?? 'issue_date',
    storage_path: row.storage_path ?? null,
    is_builtin: row.is_builtin ?? false,
    created_at: row.created_at ?? '',
    svgContent: null,
  }
}

export function createTemplatesSupabaseAdapter() {
  return {
    async list() {
      const { data, error } = await supabase
        .from('svg_templates')
        .select('*')
        .eq('is_builtin', false)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return [
        ...BUILTIN_TEMPLATES.map(template => ({
          ...template,
          svgContent: null,
        })),
        ...(data || []).map(fromDb),
      ]
    },

    async loadContent(template) {
      if (template.svgContent) {
        return sanitizeSvg(template.svgContent)
      }

      if (template.is_builtin) {
        try {
          const response = await fetch(
            `/templates/${template.file_name}`
          )

          if (!response.ok) {
            return null
          }

          return sanitizeSvg(await response.text())
        } catch (error) {
          console.warn(
            '[templatesSupabaseAdapter] builtin preview error',
            error
          )

          return null
        }
      }

      if (!template.storage_path) {
        return null
      }

      try {
        const { data } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(template.storage_path)

        const response = await fetch(
          data.publicUrl
        )

        if (!response.ok) {
          return null
        }

        return sanitizeSvg(await response.text())
      } catch (error) {
        console.warn(
          '[templatesSupabaseAdapter] custom preview error',
          error
        )

        return null
      }
    },

    async upload(file, meta = {}) {
      const svgText = sanitizeSvg(await file.text())

      if (!svgText) {
        throw new Error(
          'El archivo no contiene un SVG válido'
        )
      }

      const safeFile = new File(
        [svgText],
        file.name,
        { type: 'image/svg+xml' }
      )

      let name_id = 'recipient_name'
      let date_id = 'issue_date'

      // Analizar SVG mediante el backend
      const analyzeForm = new FormData()
      analyzeForm.append('file', safeFile)

      const analyzeResponse = await certificateApiFetch(
        `${CERT_API}/api/analyze`,
        {
          method: 'POST',
          body: analyzeForm,
        }
      )

      if (!analyzeResponse.ok) {
        const body =
          await analyzeResponse.json().catch(() => ({}))

        throw new Error(
          body.error ||
          'El backend rechazó la plantilla SVG'
        )
      }

      const { elements = [] } =
        await analyzeResponse.json()

      const nameElement =
        elements.find(e =>
          /name|nombre|participante/i.test(e.id)
        ) || elements[0]

      const dateElement =
        elements.find(e =>
          /date|fecha/i.test(e.id)
        ) || elements[1] || elements[0]

      if (nameElement) {
        name_id = nameElement.id
      }

      if (dateElement) {
        date_id = dateElement.id
      }

      // Subir plantilla
      const form = new FormData()

      form.append('file', safeFile)
      form.append(
        'name',
        meta.name ||
          file.name.replace('.svg', '')
      )
      form.append(
        'style',
        meta.style || 'Personalizado'
      )
      form.append(
        'course',
        meta.course || 'Todos los programas'
      )
      form.append('name_id', name_id)
      form.append('date_id', date_id)
      form.append(
        'colors',
        JSON.stringify(
          meta.colors || ['#666666']
        )
      )
      form.append(
        'tags',
        JSON.stringify(
          meta.tags || ['personalizado', 'subido']
        )
      )

      const response = await certificateApiFetch(
        `${CERT_API}/api/templates/upload`,
        {
          method: 'POST',
          body: form,
        }
      )

      const body =
        await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          body.error ||
          'No se pudo guardar la plantilla'
        )
      }

      return {
        ...fromDb(body.template),
        svgContent: svgText,
      }
    },

    async remove(id) {
      const response = await certificateApiFetch(
        `${CERT_API}/api/templates/delete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id }),
        }
      )

      if (!response.ok) {
        const body =
          await response.json().catch(() => ({}))

        throw new Error(
          body.error ||
          'No se pudo eliminar la plantilla'
        )
      }
    },
  }
}
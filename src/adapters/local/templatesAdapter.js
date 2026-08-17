import { sanitizeSvg } from '../../utils/svg.js'

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

export function createTemplatesLocalAdapter() {
  let templates = BUILTIN_TEMPLATES.map(template => ({
    ...template,
    svgContent: null,
  }))

  return {
    async list() {
      return [...templates]
    },

    async loadContent(template) {
      if (template.svgContent) {
        return sanitizeSvg(template.svgContent)
      }

      if (!template.is_builtin) {
        return null
      }

      try {
        const response = await fetch(
          `/templates/${template.file_name}`
        )

        if (!response.ok) {
          console.warn(
            `[templatesLocalAdapter] fetch ${response.status} for ${template.file_name}`
          )
          return null
        }

        return sanitizeSvg(await response.text())
      } catch (error) {
        console.warn(
          `[templatesLocalAdapter] preview error for ${template.file_name}`,
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

      const newTemplate = {
        id: `local-${Date.now()}`,
        name:
          meta.name ||
          file.name
            .replace('.svg', '')
            .replace(/[-_]/g, ' '),

        file_name: file.name,
        style: meta.style || 'Personalizado',
        course: meta.course || 'Todos los programas',
        colors: meta.colors || ['#666666'],
        tags: meta.tags || ['personalizado', 'subido'],
        name_id: meta.name_id || 'recipient_name',
        date_id: meta.date_id || 'issue_date',
        storage_path: null,
        is_builtin: false,
        created_at: new Date().toISOString().split('T')[0],
        svgContent: svgText,
        _file: safeFile,
      }

      templates = [
        ...templates,
        newTemplate,
      ]

      return newTemplate
    },

    async remove(id) {
      templates = templates.filter(
        template => template.id !== id
      )
    },
  }
}
// ============================================================
//  useTemplates.js — Hook de plantillas SVG para certificados
//
//  Si Supabase está configurado:
//    - Lee la tabla `svg_templates`
//    - Sube el archivo SVG al bucket `certificate-templates`
//    - Guarda metadata en la tabla
//  Si no: fallback a estado en memoria (las 2 plantillas built-in)
//
//  Tabla esperada en Supabase:
//    CREATE TABLE svg_templates (
//      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//      name        text NOT NULL,
//      file_name   text NOT NULL,
//      style       text DEFAULT 'Personalizado',
//      course      text DEFAULT 'Todos los programas',
//      tags        text[] DEFAULT '{}',
//      colors      text[] DEFAULT '{}',
//      name_id     text DEFAULT 'recipient_name',
//      date_id     text DEFAULT 'issue_date',
//      storage_path text,          -- ruta en el bucket
//      is_builtin  boolean DEFAULT false,
//      created_at  timestamptz DEFAULT now()
//    );
//
//  Bucket en Supabase Storage: certificate-templates (público)
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { supabase, storageMode } from '../lib/supabase.js'
import { CERT_API } from '../config.js'
import { sanitizeSvg } from '../utils/svg.js'
import { certificateApiFetch } from '../lib/certificateApi.js'

const BUCKET   = 'certificate-templates'
const MAX_SVG_UPLOAD_BYTES = 5 * 1024 * 1024

// Plantillas built-in (siempre presentes, SVG se carga desde el backend)
const BUILTIN_TEMPLATES = [
  {
    id: 'builtin-classic', name: 'Clásico Dorado', file_name: 'template_classic.svg',
    style: 'Institucional', course: 'Todos los programas',
    colors: ['#C9A227','#8B1A1A','#2C1810'],
    tags: ['horizontal','clásico','dorado','institucional'],
    name_id: 'recipient_name', date_id: 'issue_date',
    is_builtin: true, created_at: '2026-01-10',
  },
  {
    id: 'builtin-modern', name: 'Moderno Oscuro', file_name: 'template_modern.svg',
    style: 'Contemporáneo', course: 'Todos los programas',
    colors: ['#0D1B2A','#00C9FF','#92FE9D'],
    tags: ['horizontal','moderno','oscuro','tech'],
    name_id: 'recipient_name', date_id: 'issue_date',
    is_builtin: true, created_at: '2026-01-10',
  },
]

function fromDb(row) {
  return {
    id:           row.id,
    name:         row.name,
    file_name:    row.file_name,
    style:        row.style        ?? 'Personalizado',
    course:       row.course       ?? 'Todos los programas',
    colors:       row.colors       ?? ['#666666'],
    tags:         row.tags         ?? ['personalizado'],
    name_id:      row.name_id      ?? 'recipient_name',
    date_id:      row.date_id      ?? 'issue_date',
    storage_path: row.storage_path ?? null,
    is_builtin:   row.is_builtin   ?? false,
    created_at:   row.created_at   ?? '',
    svgContent:   null,   // se carga aparte
  }
}

export function useTemplates() {
  const [templates,  setTemplates]  = useState(BUILTIN_TEMPLATES.map(t => ({...t, svgContent: null})))
  const [loading,    setLoading]    = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [error,      setError]      = useState(null)

  // ── Cargar desde Supabase ──────────────────────────────────
  const loadFromDb = useCallback(async () => {
    if (storageMode=== 'local') return
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('svg_templates')
        .select('*')
        .eq('is_builtin', false)
        .order('created_at', { ascending: false })

      if (err) throw err

      const custom = (data || []).map(fromDb)
      setTemplates([
        ...BUILTIN_TEMPLATES.map(t => ({...t, svgContent: null})),
        ...custom,
      ])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadFromDb() }, [loadFromDb])

  // ── Cargar SVG content de una plantilla ───────────────────
  const loadSvgContent = useCallback(async (tpl) => {
    if (tpl.svgContent) return sanitizeSvg(tpl.svgContent)

    // Built-in: archivos estáticos en /templates/ (sin dependencia del backend)
    if (tpl.is_builtin) {
      try {
        const r = await fetch(`/templates/${tpl.file_name}`)
        if (r.ok) return sanitizeSvg(await r.text())
        console.warn(`[useTemplates] built-in preview fetch ${r.status} for ${tpl.file_name}`)
      } catch (e) {
        console.warn(`[useTemplates] built-in preview error for ${tpl.file_name}:`, e)
      }
      return null
    }

    // Custom: cargar desde Supabase Storage
    if (tpl.storage_path && storageMode=== 'supabase') {
      try {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(tpl.storage_path)
        const r = await fetch(data.publicUrl)
        if (r.ok) return sanitizeSvg(await r.text())
        console.warn(`[useTemplates] custom preview fetch ${r.status} for ${tpl.storage_path}`)
      } catch (e) {
        console.warn(`[useTemplates] custom preview error for ${tpl.storage_path}:`, e)
      }
    }
    return null
  }, [])

  // ── Subir nuevo SVG ───────────────────────────────────────
  const uploadTemplate = useCallback(async (file, meta = {}) => {
    if (!file || !file.name.endsWith('.svg')) {
      setError('Solo se aceptan archivos .svg')
      return null
    }
    if (file.size > MAX_SVG_UPLOAD_BYTES) {
      setError('El SVG supera el máximo permitido de 5 MB')
      return null
    }
    setUploading(true)
    setError(null)

    try {
      const svgText = sanitizeSvg(await file.text())
      if (!svgText) throw new Error('El archivo no contiene un SVG válido')
      const safeFile = new File([svgText], file.name, { type: 'image/svg+xml' })

      // Detectar IDs automáticamente via backend
      let name_id = 'recipient_name'
      let date_id = 'issue_date'
      try {
        const form = new FormData(); form.append('file', safeFile)
        const r = await certificateApiFetch(`${CERT_API}/api/analyze`, { method: 'POST', body: form })
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          throw new Error(body.error || 'El backend rechazó la plantilla SVG')
        }
        const { elements = [] } = await r.json()
        const nameEl = elements.find(e => /name|nombre|participante/i.test(e.id)) || elements[0]
        const dateEl = elements.find(e => /date|fecha/i.test(e.id))             || elements[1] || elements[0]
        if (nameEl) name_id = nameEl.id
        if (dateEl) date_id = dateEl.id
      } catch (e) {
        if (storageMode=== 'supabase') throw e
      }

      const newTpl = {
        id:       'local-' + Date.now(),
        name:     meta.name || file.name.replace('.svg','').replace(/[-_]/g,' '),
        file_name: file.name,
        style:    meta.style  || 'Personalizado',
        course:   meta.course || 'Todos los programas',
        colors:   meta.colors || ['#666666'],
        tags:     meta.tags   || ['personalizado','subido'],
        name_id,
        date_id,
        storage_path: null,
        is_builtin:   false,
        created_at:   new Date().toISOString().split('T')[0],
        svgContent:   svgText,
        _file:        safeFile, // referencia sanitizada para uso inmediato
      }

      // Si Supabase está configurado: subir al storage y guardar metadata
      if (storageMode=== 'supabase') {
        const form = new FormData()
        form.append('file', safeFile)
        for (const key of ['name', 'style', 'course', 'name_id', 'date_id']) {
          form.append(key, newTpl[key])
        }
        form.append('colors', JSON.stringify(newTpl.colors))
        form.append('tags', JSON.stringify(newTpl.tags))
        const response = await certificateApiFetch(`${CERT_API}/api/templates/upload`, {
          method: 'POST', body: form,
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'No se pudo guardar la plantilla')
        const row = body.template

        const saved = { ...fromDb(row), svgContent: svgText }
        setTemplates(ts => [...ts, saved])
        return saved
      } else {
        // Sin Supabase: solo en memoria
        setTemplates(ts => [...ts, newTpl])
        return newTpl
      }
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setUploading(false)
    }
  }, [])

  // ── Eliminar plantilla ────────────────────────────────────
  const deleteTemplate = useCallback(async (id) => {
    const tpl = templates.find(t => t.id === id)
    if (!tpl || tpl.is_builtin) return

    if (storageMode=== 'supabase') {
      const response = await certificateApiFetch(`${CERT_API}/api/templates/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.error || 'No se pudo eliminar la plantilla')
        return
      }
    }

    setTemplates(ts => ts.filter(t => t.id !== id))
  }, [templates])

  // ── Actualizar SVG content en el estado ──────────────────
  const setSvgContent = useCallback((id, content) => {
    setTemplates(ts => ts.map(t => t.id === id ? { ...t, svgContent: content } : t))
  }, [])

  return {
    templates,
    loading,
    uploading,
    error,
    uploadTemplate,
    deleteTemplate,
    loadSvgContent,
    setSvgContent,
    reload: loadFromDb,
  }
}

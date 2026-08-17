// ============================================================
// useTemplates.js — Hook de plantillas SVG para certificados
//
// El hook mantiene la API pública de la aplicación y delega
// las operaciones de persistencia al adapter correspondiente.
//
// API pública:
//   {
//     templates,
//     loading,
//     uploading,
//     error,
//     uploadTemplate,
//     deleteTemplate,
//     loadSvgContent,
//     setSvgContent,
//     reload,
//   }
//
// Los adapters implementan:
//   list()
//   loadContent(template)
//   upload(file, meta)
//   remove(id)
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react'

import { storageMode } from '../lib/supabase.js'

import { createTemplatesSupabaseAdapter } from '../adapters/supabase/templatesAdapter.js'
import { createTemplatesLocalAdapter } from '../adapters/local/templatesAdapter.js'

const MAX_SVG_UPLOAD_BYTES = 5 * 1024 * 1024

export function useTemplates() {

  // ==========================================================
  // Adapter
  // ==========================================================

  const adapter = useMemo(() => {
    if (storageMode === 'supabase') {
      return createTemplatesSupabaseAdapter()
    }

    return createTemplatesLocalAdapter()
  }, [])

  // ==========================================================
  // Estado
  // ==========================================================

  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  // ==========================================================
  // Cargar plantillas
  // ==========================================================

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await adapter.list()

      setTemplates(data || [])
    } catch (e) {
      console.error('[useTemplates] load', e)

      setError(
        e?.message ||
        'No se pudieron cargar las plantillas'
      )
    } finally {
      setLoading(false)
    }
  }, [adapter])

  // ==========================================================
  // Carga inicial
  // ==========================================================

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // ==========================================================
  // Cargar contenido SVG
  // ==========================================================

  const loadSvgContent = useCallback(async (template) => {
    if (!template) return null

    try {
      return await adapter.loadContent(template)
    } catch (e) {
      console.error(
        '[useTemplates] loadSvgContent',
        e
      )

      setError(
        e?.message ||
        'No se pudo cargar el contenido SVG'
      )

      return null
    }
  }, [adapter])

  // ==========================================================
  // Subir plantilla
  // ==========================================================

  const uploadTemplate = useCallback(async (
    file,
    meta = {}
  ) => {

    // --------------------------------------------------------
    // Validación
    // --------------------------------------------------------

    if (!file) {
      setError('No se seleccionó ningún archivo')
      return null
    }

    if (!file.name.toLowerCase().endsWith('.svg')) {
      setError('Solo se aceptan archivos .svg')
      return null
    }

    if (file.size > MAX_SVG_UPLOAD_BYTES) {
      setError(
        'El SVG supera el máximo permitido de 5 MB'
      )
      return null
    }

    // --------------------------------------------------------
    // Upload
    // --------------------------------------------------------

    setUploading(true)
    setError(null)

    try {
      const newTemplate = await adapter.upload(
        file,
        meta
      )

      if (!newTemplate) {
        throw new Error(
          'No se pudo crear la plantilla'
        )
      }

      setTemplates(prev => [
        ...prev,
        newTemplate,
      ])

      return newTemplate

    } catch (e) {
      console.error(
        '[useTemplates] upload',
        e
      )

      setError(
        e?.message ||
        'No se pudo guardar la plantilla'
      )

      return null

    } finally {
      setUploading(false)
    }
  }, [adapter])

  // ==========================================================
  // Eliminar plantilla
  // ==========================================================

  const deleteTemplate = useCallback(async (id) => {

    const template = templates.find(
      t => t.id === id
    )

    // No existe
    if (!template) {
      return
    }

    // Las built-in no se pueden eliminar
    if (template.is_builtin) {
      return
    }

    setError(null)

    try {

      await adapter.remove(id)

      setTemplates(prev =>
        prev.filter(
          template => template.id !== id
        )
      )

    } catch (e) {
      console.error(
        '[useTemplates] delete',
        e
      )

      setError(
        e?.message ||
        'No se pudo eliminar la plantilla'
      )
    }

  }, [adapter, templates])

  // ==========================================================
  // Actualizar contenido SVG en memoria
  // ==========================================================

  const setSvgContent = useCallback((
    id,
    content
  ) => {

    setTemplates(prev =>
      prev.map(template =>
        template.id === id
          ? {
              ...template,
              svgContent: content,
            }
          : template
      )
    )

  }, [])

  // ==========================================================
  // API pública
  // ==========================================================

  return {
    templates,
    loading,
    uploading,
    error,

    uploadTemplate,
    deleteTemplate,
    loadSvgContent,
    setSvgContent,

    reload: loadTemplates,
  }
}
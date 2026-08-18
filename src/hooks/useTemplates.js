// ============================================================
// useTemplates.js — Hook de plantillas SVG para certificados
//
// El hook mantiene la API pública de la aplicación y delega
// las operaciones de persistencia al adapter correspondiente.
//
// El hook controla estados independientes de carga y error
// para la carga inicial, subida y eliminación de plantillas.
// Las operaciones solo actualizan el estado local cuando el
// adapter confirma que fueron exitosas.
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
//
// API pública:
//   {
//     templates,
//     loading,
//     uploading,
//     deleting,
//     error,
//     uploadError,
//     deleteError,
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

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react'

import { storageMode } from '../lib/supabase.js'

import {
  createTemplatesSupabaseAdapter,
} from '../adapters/supabase/templatesAdapter.js'

import {
  createTemplatesLocalAdapter,
} from '../adapters/local/templatesAdapter.js'

const MAX_SVG_UPLOAD_BYTES = 5 * 1024 * 1024

// ============================================================
// Hook
// ============================================================

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

  // Carga inicial
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Upload
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] =
    useState(null)

  // Delete
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] =
    useState(null)

  // ==========================================================
  // Cargar plantillas
  // ==========================================================

  const loadTemplates = useCallback(
    async () => {
      setLoading(true)
      setError(null)

      try {
        const result =
          await adapter.list()

        if (result?.error) {
          console.error(
            '[useTemplates] load',
            result.error
          )

          setError(result.error)
          setTemplates([])

          return result
        }

        setTemplates(result || [])

        return result || []

      } catch (error) {
        console.error(
          '[useTemplates] load',
          error
        )

        const loadError = {
          message:
            error?.message ||
            'No se pudieron cargar las plantillas.',
          code:
            error?.code ||
            'TEMPLATES_LOAD_ERROR',
        }

        setError(loadError)
        setTemplates([])

        return {
          error: loadError,
        }

      } finally {
        setLoading(false)
      }
    },
    [adapter]
  )

  // ==========================================================
  // Carga inicial
  // ==========================================================

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (cancelled) return

      await loadTemplates()
    }

    load()

    return () => {
      cancelled = true
    }
  }, [loadTemplates])

  // ==========================================================
  // Cargar contenido SVG
  // ==========================================================

  const loadSvgContent = useCallback(
    async template => {

      if (!template) {
        const result = {
          error: {
            message:
              'No se proporcionó una plantilla.',
            code:
              'TEMPLATE_REQUIRED',
          },
        }

        setError(result.error)

        return result
      }

      try {
        const result =
          await adapter.loadContent(template)

        if (result?.error) {
          console.error(
            '[useTemplates] loadSvgContent',
            result.error
          )

          setError(result.error)

          return result
        }

        return result

      } catch (error) {
        console.error(
          '[useTemplates] loadSvgContent',
          error
        )

        const loadError = {
          message:
            error?.message ||
            'No se pudo cargar el contenido SVG.',
          code:
            error?.code ||
            'SVG_CONTENT_LOAD_ERROR',
        }

        setError(loadError)

        return {
          error: loadError,
        }
      }
    },
    [adapter]
  )

  // ==========================================================
  // Subir plantilla
  // ==========================================================

  const uploadTemplate = useCallback(
    async (file, meta = {}) => {

      // ------------------------------------------------------
      // Limpiar error anterior
      // ------------------------------------------------------

      setUploadError(null)
      setError(null)

      // ------------------------------------------------------
      // Validación
      // ------------------------------------------------------

      if (!file) {
        const result = {
          error: {
            message:
              'No se seleccionó ningún archivo.',
            code:
              'SVG_FILE_REQUIRED',
          },
        }

        setUploadError(result.error)

        return result
      }

      if (
        !file.name
          .toLowerCase()
          .endsWith('.svg')
      ) {
        const result = {
          error: {
            message:
              'Solo se aceptan archivos .svg.',
            code:
              'INVALID_SVG_FILE',
          },
        }

        setUploadError(result.error)

        return result
      }

      if (file.size > MAX_SVG_UPLOAD_BYTES) {
        const result = {
          error: {
            message:
              'El SVG supera el máximo permitido de 5 MB.',
            code:
              'SVG_FILE_TOO_LARGE',
          },
        }

        setUploadError(result.error)

        return result
      }

      // ------------------------------------------------------
      // Upload
      // ------------------------------------------------------

      setUploading(true)

      try {
        const result =
          await adapter.upload(
            file,
            meta
          )

        if (result?.error) {
          console.error(
            '[useTemplates] upload',
            result.error
          )

          setUploadError(result.error)

          return result
        }

        // ----------------------------------------------------
        // Actualizar estado solamente después de confirmar
        // que la plantilla fue guardada correctamente.
        // ----------------------------------------------------

        setTemplates(prev => [
          ...prev,
          result,
        ])

        return result

      } catch (error) {
        console.error(
          '[useTemplates] upload',
          error
        )

        const uploadError = {
          message:
            error?.message ||
            'No se pudo guardar la plantilla.',
          code:
            error?.code ||
            'TEMPLATE_UPLOAD_ERROR',
        }

        setUploadError(uploadError)

        return {
          error: uploadError,
        }

      } finally {
        setUploading(false)
      }
    },
    [adapter]
  )

  // ==========================================================
  // Eliminar plantilla
  // ==========================================================

  const deleteTemplate = useCallback(
    async id => {

      setDeleteError(null)
      setError(null)

      const template =
        templates.find(
          t => t.id === id
        )

      // ------------------------------------------------------
      // No existe
      // ------------------------------------------------------

      if (!template) {
        const result = {
          error: {
            message:
              'La plantilla no existe.',
            code:
              'TEMPLATE_NOT_FOUND',
          },
        }

        setDeleteError(result.error)

        return result
      }

      // ------------------------------------------------------
      // Built-in
      // ------------------------------------------------------

      if (template.is_builtin) {
        const result = {
          error: {
            message:
              'Las plantillas integradas no se pueden eliminar.',
            code:
              'BUILTIN_TEMPLATE',
          },
        }

        setDeleteError(result.error)

        return result
      }

      // ------------------------------------------------------
      // Delete
      // ------------------------------------------------------

      setDeleting(true)

      try {
        const result =
          await adapter.remove(id)

        if (result?.error) {
          console.error(
            '[useTemplates] delete',
            result.error
          )

          setDeleteError(result.error)

          return result
        }

        // ----------------------------------------------------
        // Actualizar estado solamente después de confirmar
        // que la plantilla fue eliminada correctamente.
        // ----------------------------------------------------

        setTemplates(prev =>
          prev.filter(
            template =>
              template.id !== id
          )
        )

        return result

      } catch (error) {
        console.error(
          '[useTemplates] delete',
          error
        )

        const deleteError = {
          message:
            error?.message ||
            'No se pudo eliminar la plantilla.',
          code:
            error?.code ||
            'TEMPLATE_DELETE_ERROR',
        }

        setDeleteError(deleteError)

        return {
          error: deleteError,
        }

      } finally {
        setDeleting(false)
      }
    },
    [adapter, templates]
  )

  // ==========================================================
  // Actualizar contenido SVG en memoria
  // ==========================================================

  const setSvgContent = useCallback(
    (id, content) => {
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
    },
    []
  )

  // ==========================================================
  // API pública
  // ==========================================================

  return {
    templates,

    loading,
    error,

    uploading,
    uploadError,

    deleting,
    deleteError,

    uploadTemplate,
    deleteTemplate,
    loadSvgContent,
    setSvgContent,

    reload: loadTemplates,
  }
}
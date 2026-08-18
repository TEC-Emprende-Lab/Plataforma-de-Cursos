// ============================================================
// useTags.js — Hook de etiquetas
//
// La persistencia se delega al adapter correspondiente según
// VITE_STORAGE_MODE.
//
// El hook mantiene estados independientes de carga y error
// para cada mutación, evitando que la interfaz muestre
// mensajes de éxito cuando la operación realmente falló.
//
// API pública:
//   {
//     tags,
//     loading,
//     error,
//     addTag,
//     addLoading,
//     addError,
//     editTag,
//     editLoading,
//     editError,
//     deleteTag,
//     deleteLoading,
//     deleteError,
//   }
//
// Contrato de mutaciones:
//   Éxito con entidad -> entity
//   Éxito sin entidad -> objeto explícito
//   Error             -> { error: { message, code } }
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
} from 'react'

import { storageMode } from '../lib/supabase.js'

import {
  tagsLocalAdapter,
} from '../adapters/local/tagsAdapter.js'

import {
  tagsSupabaseAdapter,
} from '../adapters/supabase/tagsAdapter.js'

// ============================================================
// Seleccionar adapter
// ============================================================

const tagsAdapter =
  storageMode === 'local'
    ? tagsLocalAdapter
    : tagsSupabaseAdapter

// ============================================================
// Hook
// ============================================================

export function useTags() {

  const [tags, setTags] = useState([])

  // ==========================================================
  // Estado de carga/error inicial
  // ==========================================================

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ==========================================================
  // Estados de mutaciones
  // ==========================================================

  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState(null)

  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState(null)

  const [deleteLoading, setDeleteLoading] =
    useState(false)

  const [deleteError, setDeleteError] =
    useState(null)

  // ==========================================================
  // Carga inicial
  // ==========================================================

  useEffect(() => {
    let cancelled = false

    const loadTags = async () => {
      setLoading(true)
      setError(null)

      try {
        const result =
          await tagsAdapter.getAll()

        if (cancelled) return

        if (result?.error) {
          console.error(
            '[useTags] getAll',
            result.error
          )

          setError(result.error)
          setTags([])

          return
        }

        setTags(result || [])

      } catch (error) {
        if (cancelled) return

        console.error(
          '[useTags] getAll',
          error
        )

        setError({
          message:
            error?.message ||
            'No se pudieron cargar las etiquetas.',
          code:
            error?.code ||
            'TAGS_LOAD_ERROR',
        })

        setTags([])

      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadTags()

    return () => {
      cancelled = true
    }
  }, [])

  // ==========================================================
  // Agregar
  // ==========================================================

  const addTag = useCallback(
    async (name, color) => {
      setAddLoading(true)
      setAddError(null)

      try {
        const result =
          await tagsAdapter.add(
            name,
            color
          )

        if (result?.error) {
          console.error(
            '[useTags] add',
            result.error
          )

          setAddError(result.error)

          return result
        }

        setTags(prev => [
          ...prev,
          result,
        ])

        return result

      } catch (error) {
        console.error(
          '[useTags] add',
          error
        )

        const operationError = {
          message:
            error?.message ||
            'No se pudo agregar la etiqueta.',
          code:
            error?.code ||
            'TAG_CREATE_ERROR',
        }

        setAddError(operationError)

        return {
          error: operationError,
        }

      } finally {
        setAddLoading(false)
      }
    },
    []
  )

  // ==========================================================
  // Editar
  // ==========================================================

  const editTag = useCallback(
    async (id, name, color) => {
      setEditLoading(true)
      setEditError(null)

      try {
        const result =
          await tagsAdapter.update(
            id,
            name,
            color
          )

        if (result?.error) {
          console.error(
            '[useTags] edit',
            result.error
          )

          setEditError(result.error)

          return result
        }

        setTags(prev =>
          prev.map(tag =>
            tag.id === id
              ? result
              : tag
          )
        )

        return result

      } catch (error) {
        console.error(
          '[useTags] edit',
          error
        )

        const operationError = {
          message:
            error?.message ||
            'No se pudo actualizar la etiqueta.',
          code:
            error?.code ||
            'TAG_UPDATE_ERROR',
        }

        setEditError(operationError)

        return {
          error: operationError,
        }

      } finally {
        setEditLoading(false)
      }
    },
    []
  )

  // ==========================================================
  // Eliminar
  // ==========================================================

  const deleteTag = useCallback(
    async (id, setParticipants) => {
      setDeleteLoading(true)
      setDeleteError(null)

      try {
        const result =
          await tagsAdapter.remove(id)

        if (result?.error) {
          console.error(
            '[useTags] delete',
            result.error
          )

          setDeleteError(result.error)

          return result
        }

        // ----------------------------------------------------
        // Actualizar estado solamente después de confirmar
        // que el adapter eliminó correctamente la etiqueta.
        // ----------------------------------------------------

        setTags(prev =>
          prev.filter(tag => tag.id !== id)
        )

        // La eliminación de participant_tags
        // en Supabase ocurre mediante FK cascade.
        //
        // En local también actualizamos el estado
        // de participantes.

        if (setParticipants) {
          setParticipants(prev =>
            prev.map(participant => ({
              ...participant,
              tags:
                (participant.tags || [])
                  .filter(
                    tagId => tagId !== id
                  ),
            }))
          )
        }

        return result

      } catch (error) {
        console.error(
          '[useTags] delete',
          error
        )

        const operationError = {
          message:
            error?.message ||
            'No se pudo eliminar la etiqueta.',
          code:
            error?.code ||
            'TAG_DELETE_ERROR',
        }

        setDeleteError(operationError)

        return {
          error: operationError,
        }

      } finally {
        setDeleteLoading(false)
      }
    },
    []
  )

  // ==========================================================
  // API pública
  // ==========================================================

  return {
    tags,

    loading,
    error,

    addTag,
    addLoading,
    addError,

    editTag,
    editLoading,
    editError,

    deleteTag,
    deleteLoading,
    deleteError,
  }
}
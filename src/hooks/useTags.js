// ============================================================
// useTags.js — Hook de etiquetas
//
// La persistencia se delega al adapter correspondiente.
//
// API pública:
//   { tags, addTag, editTag, deleteTag }
// ============================================================

import { useState, useEffect, useCallback, } from 'react'
import { storageMode } from '../lib/supabase.js'
import { tagsLocalAdapter, } from '../adapters/local/tagsAdapter.js'
import { tagsSupabaseAdapter, } from '../adapters/supabase/tagsAdapter.js'

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
  // Carga inicial
  // ==========================================================

  useEffect(() => {
    let cancelled = false

    tagsAdapter
      .getAll()
      .then(data => {
        if (cancelled) return

        setTags(data || [])
      })
      .catch(error => {
        if (cancelled) return

        console.error(
          '[useTags] fetch',
          error
        )
      })

    return () => {
      cancelled = true
    }
  }, [])

  // ==========================================================
  // Agregar
  // ==========================================================

  const addTag = useCallback(
    async (name, color) => {
      try {
        const tag =
          await tagsAdapter.add(
            name,
            color
          )

        setTags(prev => [
          ...prev,
          tag,
        ])

        return tag

      } catch (error) {
        console.error(
          '[useTags] add',
          error
        )

        return { error }
      }
    },
    []
  )

  // ==========================================================
  // Editar
  // ==========================================================

  const editTag = useCallback(
    async (id, name, color) => {
      try {
        const tag =
          await tagsAdapter.update(
            id,
            name,
            color
          )

        setTags(prev =>
          prev.map(t =>
            t.id === id
              ? tag
              : t
          )
        )

        return tag

      } catch (error) {
        console.error(
          '[useTags] edit',
          error
        )

        return { error }
      }
    },
    []
  )

  // ==========================================================
  // Eliminar
  // ==========================================================

  const deleteTag = useCallback(
    async (id, setParticipants) => {
      try {
        await tagsAdapter.remove(id)

        setTags(prev =>
          prev.filter(t => t.id !== id)
        )

        // La eliminación de participant_tags en Supabase
        // ocurre mediante FK cascade.
        //
        // En local debemos actualizar también el estado
        // de participantes.

        if (setParticipants) {
          setParticipants(prev =>
            prev.map(p => ({
              ...p,
              tags: (p.tags || [])
                .filter(tagId => tagId !== id),
            }))
          )
        }

      } catch (error) {
        console.error(
          '[useTags] delete',
          error
        )

        return { error }
      }
    },
    []
  )

  // ==========================================================
  // API pública
  // ==========================================================

  return {
    tags,
    addTag,
    editTag,
    deleteTag,
  }
}
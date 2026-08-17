import { useState, useEffect, useCallback, } from 'react'
import { storageMode } from '../lib/supabase.js'
import { isExpired } from '../utils/time.js'
import { participantsLocalAdapter, } from '../adapters/local/participantsAdapter.js'
import { participantsSupabaseAdapter,} from '../adapters/supabase/participantsAdapter.js'

const participantsAdapter =
  storageMode === 'local'
    ? participantsLocalAdapter
    : participantsSupabaseAdapter

function applyAutoRevoke(list) {
  return list.map(p =>
    p.access && isExpired(p.fecha)
      ? { ...p, access: false }
      : p
  )
}

export function useParticipants() {

  const [participants, setParticipants] = useState([])

  // ==========================================================
  // Carga inicial
  // ==========================================================

  useEffect(() => {
    let cancelled = false

    participantsAdapter
      .getAll()
      .then(data => {
        if (cancelled) return

        setParticipants(
          applyAutoRevoke(data || [])
        )
      })
      .catch(error => {
        if (cancelled) return

        console.error(
          '[useParticipants] fetch',
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

  const addParticipant = useCallback(
    async form => {
      try {
        const participant =
          await participantsAdapter.add(form)

        setParticipants(prev => [
          ...prev,
          participant,
        ])

        return participant

      } catch (error) {
        console.error(
          '[useParticipants] add',
          error
        )

        return { error }
      }
    },
    []
  )

  // ==========================================================
  // Actualizar
  // ==========================================================

  const updateParticipant = useCallback(
    async (id, form) => {
      try {
        const participant =
          await participantsAdapter.update(
            id,
            form
          )

        if (participant) {
          setParticipants(prev =>
            prev.map(p =>
              p.id === id
                ? participant
                : p
            )
          )
        }

        return participant

      } catch (error) {
        console.error(
          '[useParticipants] update',
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

  const deleteParticipant = useCallback(
    async id => {
      try {
        await participantsAdapter.remove(id)

        setParticipants(prev =>
          prev.filter(p => p.id !== id)
        )

      } catch (error) {
        console.error(
          '[useParticipants] delete',
          error
        )

        return { error }
      }
    },
    []
  )

  // ==========================================================
  // Toggle access
  // ==========================================================

  const toggleAccess = useCallback(
    async id => {
      const current =
        participants.find(p => p.id === id)

      if (!current) return

      try {
        const patch =
          await participantsAdapter.toggleAccess(
            id,
            current
          )

        setParticipants(prev =>
          prev.map(p =>
            p.id === id
              ? { ...p, ...patch }
              : p
          )
        )

      } catch (error) {
        console.error(
          '[useParticipants] toggleAccess',
          error
        )

        return { error }
      }
    },
    [participants]
  )

  // ==========================================================
  // Renovar acceso
  // ==========================================================

  const renewAccess = useCallback(
    async id => {
      try {
        const patch =
          await participantsAdapter.renewAccess(id)

        setParticipants(prev =>
          prev.map(p =>
            p.id === id
              ? { ...p, ...patch }
              : p
          )
        )

      } catch (error) {
        console.error(
          '[useParticipants] renewAccess',
          error
        )

        return { error }
      }
    },
    []
  )

  // ==========================================================
  // Importar
  // ==========================================================

  const importParticipants = useCallback(
    async list => {
      try {
        const {
          participants: added,
          errors,
        } =
          await participantsAdapter.import(list)

        if (added.length) {
          setParticipants(prev => [
            ...prev,
            ...added,
          ])
        }

        return {
          ids: added.map(p => p.id),
          errors,
        }

      } catch (error) {
        console.error(
          '[useParticipants] import',
          error
        )

        return {
          ids: [],
          errors: [
            {
              name: 'Importación',
              message:
                error.message ||
                'Error desconocido',
            },
          ],
        }
      }
    },
    []
  )

  // ==========================================================
  // Actualización masiva
  // ==========================================================

  const bulkUpdate = useCallback(
    async (ids, patch = {}, addCourses = []) => {
      if (!ids?.length) return

      try {
        const refreshed =
          await participantsAdapter.bulkUpdate(
            ids,
            patch,
            addCourses
          )

        setParticipants(prev =>
          prev.map(p => {
            const updated =
              refreshed.find(
                r => r.id === p.id
              )

            return updated || p
          })
        )

      } catch (error) {
        console.error(
          '[useParticipants] bulkUpdate',
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
    participants,
    setParticipants,
    addParticipant,
    updateParticipant,
    deleteParticipant,
    toggleAccess,
    renewAccess,
    importParticipants,
    bulkUpdate,
  }
}
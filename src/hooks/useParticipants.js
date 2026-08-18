// ============================================================
// useParticipants.js — Hook de participantes
//
// La persistencia se delega al adapter correspondiente.
//
// El hook mantiene la API pública de la aplicación y gestiona:
//   - Estado de participantes
//   - Carga inicial
//   - Estados de carga/error por operación
//   - Agregar, actualizar y eliminar participantes
//   - Acceso y renovación
//   - Importación
//   - Actualización masiva
//
// Los adapters retornan errores mediante:
//   { error: { message, code } }
//
// Excepción legítima:
//   import() puede retornar:
//   { participants, errors }
//   para representar errores parciales.
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
} from 'react'

import { storageMode } from '../lib/supabase.js'
import { isExpired } from '../utils/time.js'

import {
  participantsLocalAdapter,
} from '../adapters/local/participantsAdapter.js'

import {
  participantsSupabaseAdapter,
} from '../adapters/supabase/participantsAdapter.js'

// ============================================================
// Seleccionar adapter
// ============================================================

const participantsAdapter =
  storageMode === 'local'
    ? participantsLocalAdapter
    : participantsSupabaseAdapter

// ============================================================
// Helpers
// ============================================================

function createHookError(
  message,
  code
) {
  return {
    message,
    code,
  }
}

function normalizeError(
  error,
  fallbackMessage,
  fallbackCode
) {
  return {
    message:
      error?.message ||
      fallbackMessage,
    code:
      error?.code ||
      fallbackCode,
  }
}

function applyAutoRevoke(list) {
  return list.map(p =>
    p.access && isExpired(p.fecha)
      ? {
          ...p,
          access: false,
        }
      : p
  )
}

// ============================================================
// Hook
// ============================================================

export function useParticipants() {

  const [participants, setParticipants] =
    useState([])

  // ==========================================================
  // Estado de carga/error inicial
  // ==========================================================

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState(null)

  // ==========================================================
  // Estados de mutaciones
  // ==========================================================

  const [addLoading, setAddLoading] =
    useState(false)

  const [addError, setAddError] =
    useState(null)

  const [updateLoading, setUpdateLoading] =
    useState(false)

  const [updateError, setUpdateError] =
    useState(null)

  const [deleteLoading, setDeleteLoading] =
    useState(false)

  const [deleteError, setDeleteError] =
    useState(null)

  const [toggleLoading, setToggleLoading] =
    useState(false)

  const [toggleError, setToggleError] =
    useState(null)

  const [renewLoading, setRenewLoading] =
    useState(false)

  const [renewError, setRenewError] =
    useState(null)

  const [importLoading, setImportLoading] =
    useState(false)

  const [importError, setImportError] =
    useState(null)

  const [
    bulkUpdateLoading,
    setBulkUpdateLoading,
  ] = useState(false)

  const [
    bulkUpdateError,
    setBulkUpdateError,
  ] = useState(null)

  // ==========================================================
  // Carga inicial
  // ==========================================================

  useEffect(() => {
    let cancelled = false

    const loadParticipants =
      async () => {

        setLoading(true)
        setError(null)

        try {
          const result =
            await participantsAdapter.getAll()

          if (cancelled) return

          if (result?.error) {
            console.error(
              '[useParticipants] getAll',
              result.error
            )

            setError(result.error)
            setParticipants([])

            return
          }

          setParticipants(
            applyAutoRevoke(
              result || []
            )
          )

        } catch (error) {
          if (cancelled) return

          console.error(
            '[useParticipants] getAll',
            error
          )

          setError(
            normalizeError(
              error,
              'No se pudieron cargar los participantes.',
              'PARTICIPANTS_LOAD_ERROR'
            )
          )

          setParticipants([])

        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      }

    loadParticipants()

    return () => {
      cancelled = true
    }
  }, [])

  // ==========================================================
  // Agregar
  // ==========================================================

  const addParticipant = useCallback(
    async form => {

      setAddLoading(true)
      setAddError(null)

      try {
        const result =
          await participantsAdapter.add(
            form
          )

        if (result?.error) {
          console.error(
            '[useParticipants] add',
            result.error
          )

          setAddError(result.error)

          return result
        }

        setParticipants(prev => [
          ...prev,
          result,
        ])

        return result

      } catch (error) {
        console.error(
          '[useParticipants] add',
          error
        )

        const normalizedError =
          normalizeError(
            error,
            'No se pudo agregar el participante.',
            'PARTICIPANT_CREATE_ERROR'
          )

        setAddError(normalizedError)

        return {
          error: normalizedError,
        }

      } finally {
        setAddLoading(false)
      }
    },
    []
  )

  // ==========================================================
  // Actualizar
  // ==========================================================

  const updateParticipant =
    useCallback(
      async (id, form) => {

        setUpdateLoading(true)
        setUpdateError(null)

        try {
          const result =
            await participantsAdapter.update(
              id,
              form
            )

          if (result?.error) {
            console.error(
              '[useParticipants] update',
              result.error
            )

            setUpdateError(
              result.error
            )

            return result
          }

          setParticipants(prev =>
            prev.map(p =>
              p.id === id
                ? result
                : p
            )
          )

          return result

        } catch (error) {
          console.error(
            '[useParticipants] update',
            error
          )

          const normalizedError =
            normalizeError(
              error,
              'No se pudo actualizar el participante.',
              'PARTICIPANT_UPDATE_ERROR'
            )

          setUpdateError(
            normalizedError
          )

          return {
            error: normalizedError,
          }

        } finally {
          setUpdateLoading(false)
        }
      },
      []
    )

  // ==========================================================
  // Eliminar
  // ==========================================================

  const deleteParticipant =
    useCallback(
      async id => {

        setDeleteLoading(true)
        setDeleteError(null)

        try {
          const result =
            await participantsAdapter.remove(
              id
            )

          if (result?.error) {
            console.error(
              '[useParticipants] delete',
              result.error
            )

            setDeleteError(
              result.error
            )

            return result
          }

          setParticipants(prev =>
            prev.filter(
              p => p.id !== id
            )
          )

          return result

        } catch (error) {
          console.error(
            '[useParticipants] delete',
            error
          )

          const normalizedError =
            normalizeError(
              error,
              'No se pudo eliminar el participante.',
              'PARTICIPANT_DELETE_ERROR'
            )

          setDeleteError(
            normalizedError
          )

          return {
            error: normalizedError,
          }

        } finally {
          setDeleteLoading(false)
        }
      },
      []
    )

  // ==========================================================
  // Toggle access
  // ==========================================================

  const toggleAccess =
    useCallback(
      async id => {

        setToggleLoading(true)
        setToggleError(null)

        try {
          const current =
            participants.find(
              p => p.id === id
            )

          if (!current) {
            const error =
              createHookError(
                'El participante no existe.',
                'PARTICIPANT_NOT_FOUND'
              )

            setToggleError(error)

            return {
              error,
            }
          }

          const result =
            await participantsAdapter
              .toggleAccess(
                id,
                current
              )

          if (result?.error) {
            console.error(
              '[useParticipants] toggleAccess',
              result.error
            )

            setToggleError(
              result.error
            )

            return result
          }

          setParticipants(prev =>
            prev.map(p =>
              p.id === id
                ? {
                    ...p,
                    ...result,
                  }
                : p
            )
          )

          return result

        } catch (error) {
          console.error(
            '[useParticipants] toggleAccess',
            error
          )

          const normalizedError =
            normalizeError(
              error,
              'No se pudo cambiar el acceso del participante.',
              'PARTICIPANT_ACCESS_ERROR'
            )

          setToggleError(
            normalizedError
          )

          return {
            error: normalizedError,
          }

        } finally {
          setToggleLoading(false)
        }
      },
      [participants]
    )

  // ==========================================================
  // Renovar acceso
  // ==========================================================

  const renewAccess =
    useCallback(
      async id => {

        setRenewLoading(true)
        setRenewError(null)

        try {
          const result =
            await participantsAdapter
              .renewAccess(id)

          if (result?.error) {
            console.error(
              '[useParticipants] renewAccess',
              result.error
            )

            setRenewError(
              result.error
            )

            return result
          }

          setParticipants(prev =>
            prev.map(p =>
              p.id === id
                ? {
                    ...p,
                    ...result,
                  }
                : p
            )
          )

          return result

        } catch (error) {
          console.error(
            '[useParticipants] renewAccess',
            error
          )

          const normalizedError =
            normalizeError(
              error,
              'No se pudo renovar el acceso.',
              'PARTICIPANT_RENEW_ERROR'
            )

          setRenewError(
            normalizedError
          )

          return {
            error: normalizedError,
          }

        } finally {
          setRenewLoading(false)
        }
      },
      []
    )

  // ==========================================================
  // Importar
  //
  // Excepción legítima del contrato:
  //
  // - Error antes del batch:
  //     { error: { message, code } }
  //
  // - Batch ejecutado, aunque haya errores parciales:
  //     { participants, errors }
  // ==========================================================

  const importParticipants =
    useCallback(
      async list => {

        setImportLoading(true)
        setImportError(null)

        try {
          const result =
            await participantsAdapter.import(
              list
            )

          if (result?.error) {
            console.error(
              '[useParticipants] import',
              result.error
            )

            setImportError(
              result.error
            )

            return result
          }

          const added =
            result.participants || []

          const errors =
            result.errors || []

          if (added.length) {
            setParticipants(prev => [
              ...prev,
              ...added,
            ])
          }

          return {
            ids: added.map(
              p => p.id
            ),
            errors,
          }

        } catch (error) {
          console.error(
            '[useParticipants] import',
            error
          )

          const normalizedError =
            normalizeError(
              error,
              'No se pudieron importar los participantes.',
              'PARTICIPANTS_IMPORT_ERROR'
            )

          setImportError(
            normalizedError
          )

          return {
            ids: [],
            errors: [
              {
                name: 'Importación',
                message:
                  normalizedError.message,
                code:
                  normalizedError.code,
              },
            ],
          }

        } finally {
          setImportLoading(false)
        }
      },
      []
    )

  // ==========================================================
  // Actualización masiva
  // ==========================================================

  const bulkUpdate =
    useCallback(
      async (
        ids,
        patch = {},
        addCourses = []
      ) => {

        if (!ids?.length) {
          return []
        }

        setBulkUpdateLoading(true)
        setBulkUpdateError(null)

        try {
          const result =
            await participantsAdapter
              .bulkUpdate(
                ids,
                patch,
                addCourses
              )

          if (result?.error) {
            console.error(
              '[useParticipants] bulkUpdate',
              result.error
            )

            setBulkUpdateError(
              result.error
            )

            return result
          }

          setParticipants(prev =>
            prev.map(p => {
              const updated =
                result.find(
                  r => r.id === p.id
                )

              return updated || p
            })
          )

          return result

        } catch (error) {
          console.error(
            '[useParticipants] bulkUpdate',
            error
          )

          const normalizedError =
            normalizeError(
              error,
              'No se pudo realizar la actualización masiva.',
              'PARTICIPANTS_BULK_UPDATE_ERROR'
            )

          setBulkUpdateError(
            normalizedError
          )

          return {
            error: normalizedError,
          }

        } finally {
          setBulkUpdateLoading(false)
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

    loading,
    error,

    addParticipant,
    addLoading,
    addError,

    updateParticipant,
    updateLoading,
    updateError,

    deleteParticipant,
    deleteLoading,
    deleteError,

    toggleAccess,
    toggleLoading,
    toggleError,

    renewAccess,
    renewLoading,
    renewError,

    importParticipants,
    importLoading,
    importError,

    bulkUpdate,
    bulkUpdateLoading,
    bulkUpdateError,
  }
}
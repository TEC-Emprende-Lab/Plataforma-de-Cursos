// ============================================================
// useCourses.js — Hook de cursos
//
// La persistencia se delega al adapter correspondiente según
// VITE_STORAGE_MODE.
//
// El hook mantiene:
// - Estado de datos.
// - Estados de carga.
// - Estados de error.
// - Actualización optimista únicamente después de confirmar
//   que la operación en el adapter fue exitosa.
//
// API pública:
//   {
//     courses,
//     loading,
//     error,
//     addCourse,
//     addLoading,
//     addError,
//     updateCourse,
//     updateLoading,
//     updateError,
//     deleteCourse,
//     deleteLoading,
//     deleteError,
//     toggleActive,
//     toggleLoading,
//     toggleError
//   }
//
// Contrato de operaciones:
//   Éxito -> entidad / resultado de la operación
//   Error -> { error: { message, code } }
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
} from 'react'

import { storageMode } from '../lib/supabase.js'

import {
  coursesLocalAdapter,
} from '../adapters/local/coursesAdapter.js'

import {
  coursesSupabaseAdapter,
} from '../adapters/supabase/coursesAdapter.js'

// ============================================================
// Seleccionar adapter
// ============================================================

const coursesAdapter =
  storageMode === 'local'
    ? coursesLocalAdapter
    : coursesSupabaseAdapter

// ============================================================
// Helpers
// ============================================================

function normalizeError(error, fallbackMessage, fallbackCode) {
  return {
    message:
      error?.message ||
      fallbackMessage,

    code:
      error?.code ||
      fallbackCode,
  }
}

// ============================================================
// Hook
// ============================================================

export function useCourses() {

  const [courses, setCourses] = useState([])

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

  // ==========================================================
  // Obtener cursos
  // ==========================================================

  useEffect(() => {
    let cancelled = false

    const loadCourses = async () => {
      setLoading(true)
      setError(null)

      try {
        const result =
          await coursesAdapter.getCourses()

        if (cancelled) return

        // ------------------------------------------------------
        // Error reportado por el adapter
        // ------------------------------------------------------

        if (result?.error) {
          console.error(
            '[useCourses] getCourses',
            result.error
          )

          setError(result.error)
          setCourses([])

          return
        }

        // ------------------------------------------------------
        // Éxito
        // ------------------------------------------------------

        setCourses(result || [])

      } catch (error) {
        if (cancelled) return

        const normalizedError =
          normalizeError(
            error,
            'No se pudieron cargar los cursos.',
            'COURSES_LOAD_ERROR'
          )

        console.error(
          '[useCourses] getCourses',
          error
        )

        setError(normalizedError)
        setCourses([])

      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadCourses()

    return () => {
      cancelled = true
    }
  }, [])

  // ==========================================================
  // Agregar curso
  // ==========================================================

  const addCourse = useCallback(
    async form => {
      setAddLoading(true)
      setAddError(null)

      try {
        const result =
          await coursesAdapter.addCourse(form)

        // ------------------------------------------------------
        // Error reportado por el adapter
        // ------------------------------------------------------

        if (result?.error) {
          console.error(
            '[useCourses] addCourse',
            result.error
          )

          setAddError(result.error)

          return result
        }

        // ------------------------------------------------------
        // Éxito
        //
        // El estado solamente se actualiza después de confirmar
        // que el curso fue creado correctamente.
        // ------------------------------------------------------

        setCourses(prev => [
          ...prev,
          result,
        ])

        return result

      } catch (error) {
        const normalizedError =
          normalizeError(
            error,
            'No se pudo agregar el curso.',
            'COURSE_CREATE_ERROR'
          )

        console.error(
          '[useCourses] addCourse',
          error
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
  // Actualizar curso
  // ==========================================================

  const updateCourse = useCallback(
    async (id, form) => {
      setUpdateLoading(true)
      setUpdateError(null)

      try {
        const result =
          await coursesAdapter.updateCourse(
            id,
            form
          )

        // ------------------------------------------------------
        // Error reportado por el adapter
        // ------------------------------------------------------

        if (result?.error) {
          console.error(
            '[useCourses] updateCourse',
            result.error
          )

          setUpdateError(result.error)

          return result
        }

        // ------------------------------------------------------
        // Éxito
        // ------------------------------------------------------

        setCourses(prev =>
          prev.map(course =>
            course.id === id
              ? result
              : course
          )
        )

        return result

      } catch (error) {
        const normalizedError =
          normalizeError(
            error,
            'No se pudo actualizar el curso.',
            'COURSE_UPDATE_ERROR'
          )

        console.error(
          '[useCourses] updateCourse',
          error
        )

        setUpdateError(normalizedError)

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
  // Eliminar curso
  // ==========================================================

  const deleteCourse = useCallback(
    async (id, setParticipants) => {
      setDeleteLoading(true)
      setDeleteError(null)

      try {
        const result =
          await coursesAdapter.deleteCourse(id)

        // ------------------------------------------------------
        // Error reportado por el adapter
        // ------------------------------------------------------

        if (result?.error) {
          console.error(
            '[useCourses] deleteCourse',
            result.error
          )

          setDeleteError(result.error)

          return result
        }

        // ------------------------------------------------------
        // Éxito
        //
        // Solamente se elimina del estado después de confirmar
        // que la eliminación persistente fue exitosa.
        // ------------------------------------------------------

        setCourses(prev =>
          prev.filter(
            course => course.id !== id
          )
        )

        // ------------------------------------------------------
        // Sincronizar participantes en memoria
        // ------------------------------------------------------

        if (setParticipants) {
          setParticipants(prev =>
            prev.map(participant => ({
              ...participant,

              courses:
                (participant.courses || [])
                  .filter(
                    courseId => courseId !== id
                  ),
            }))
          )
        }

        return result

      } catch (error) {
        const normalizedError =
          normalizeError(
            error,
            'No se pudo eliminar el curso.',
            'COURSE_DELETE_ERROR'
          )

        console.error(
          '[useCourses] deleteCourse',
          error
        )

        setDeleteError(normalizedError)

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
  // Activar / desactivar curso
  // ==========================================================

  const toggleActive = useCallback(
    async id => {
      const current =
        courses.find(
          course => course.id === id
        )

      // --------------------------------------------------------
      // Validar que el curso exista
      // --------------------------------------------------------

      if (!current) {
        const result = {
          error: {
            message:
              'Curso no encontrado.',
            code:
              'COURSE_NOT_FOUND',
          },
        }

        setToggleError(result.error)

        return result
      }

      setToggleLoading(true)
      setToggleError(null)

      try {
        const result =
          await coursesAdapter.toggleActive(
            id,
            !current.active
          )

        // ------------------------------------------------------
        // Error reportado por el adapter
        // ------------------------------------------------------

        if (result?.error) {
          console.error(
            '[useCourses] toggleActive',
            result.error
          )

          setToggleError(result.error)

          return result
        }

        // ------------------------------------------------------
        // Éxito
        // ------------------------------------------------------

        setCourses(prev =>
          prev.map(course =>
            course.id === id
              ? result
              : course
          )
        )

        return result

      } catch (error) {
        const normalizedError =
          normalizeError(
            error,
            'No se pudo cambiar el estado del curso.',
            'COURSE_TOGGLE_ERROR'
          )

        console.error(
          '[useCourses] toggleActive',
          error
        )

        setToggleError(normalizedError)

        return {
          error: normalizedError,
        }

      } finally {
        setToggleLoading(false)
      }
    },
    [courses]
  )

  // ==========================================================
  // API pública
  // ==========================================================

  return {
    courses,

    loading,
    error,

    addCourse,
    addLoading,
    addError,

    updateCourse,
    updateLoading,
    updateError,

    deleteCourse,
    deleteLoading,
    deleteError,

    toggleActive,
    toggleLoading,
    toggleError,
  }
}
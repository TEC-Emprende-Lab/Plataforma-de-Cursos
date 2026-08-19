// ============================================================
// participantsLocalAdapter.js
// Persistencia local de participantes mediante localStorage.
//
// Mantiene el mismo contrato que el adapter de Supabase.
//
// Contrato:
//   - Éxito con entidad → entidad
//   - Éxito sin entidad → resultado explícito
//   - Error → { error: { message, code } }
//   - Import → { participants, errors }
//     cuando el batch logra ejecutarse.
// ============================================================

import {
  STORAGE_KEY,
  DEFAULT_PARTICIPANTS,
} from '../../data/constants.js'

import { todayISO } from '../../utils/time.js'

// ============================================================
// Helpers
// ============================================================

function createError(message, code) {
  return {
    error: {
      message,
      code,
    },
  }
}

function loadLocal() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY)

    return raw
      ? JSON.parse(raw)
      : structuredClone(DEFAULT_PARTICIPANTS)

  } catch (error) {
    console.error(
      '[participantsLocalAdapter] loadLocal',
      error
    )

    return createError(
      'No se pudieron cargar los participantes.',
      'PARTICIPANTS_LOAD_ERROR'
    )
  }
}

function saveLocal(participants) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(participants)
    )

    return null

  } catch (error) {
    console.error(
      '[participantsLocalAdapter] saveLocal',
      error
    )

    return createError(
      'No se pudieron guardar los participantes.',
      'PARTICIPANTS_SAVE_ERROR'
    )
  }
}

// ============================================================
// Adapter
// ============================================================

export const participantsLocalAdapter = {

  // ----------------------------------------------------------
  // Obtener todos
  // ----------------------------------------------------------

  async getAll() {
    return loadLocal()
  },

  // ----------------------------------------------------------
  // Agregar
  // ----------------------------------------------------------

  async add(form) {
    const participants = loadLocal()

    if (participants?.error) {
      return participants
    }

    const participant = {
      id:
        'p' + Date.now(),
      ...form,
      tags:
        form.tags || [],
      courses:
        form.courses || [],
      notes:
        form.notes || '',
      fecha:
        form.fecha ||
        todayISO(),
    }

    const saveResult =
      saveLocal([
        ...participants,
        participant,
      ])

    if (saveResult?.error) {
      return saveResult
    }

    return participant
  },

  // ----------------------------------------------------------
  // Actualizar
  // ----------------------------------------------------------

  async update(id, form) {
    const participants = loadLocal()

    if (participants?.error) {
      return participants
    }

    const currentParticipant =
      participants.find(
        p => p.id === id
      )

    if (!currentParticipant) {
      return createError(
        'El participante no existe.',
        'PARTICIPANT_NOT_FOUND'
      )
    }

    const updatedParticipant = {
      ...currentParticipant,
      ...form,
      tags:
        form.tags ||
        currentParticipant.tags ||
        [],
      courses:
        form.courses ||
        currentParticipant.courses ||
        [],
    }

    const updated =
      participants.map(p =>
        p.id === id
          ? updatedParticipant
          : p
      )

    const saveResult =
      saveLocal(updated)

    if (saveResult?.error) {
      return saveResult
    }

    return updatedParticipant
  },

  // ----------------------------------------------------------
  // Eliminar
  // ----------------------------------------------------------

  async remove(id) {
    const participants = loadLocal()

    if (participants?.error) {
      return participants
    }

    const exists =
      participants.some(
        p => p.id === id
      )

    if (!exists) {
      return createError(
        'El participante no existe.',
        'PARTICIPANT_NOT_FOUND'
      )
    }

    const updated =
      participants.filter(
        p => p.id !== id
      )

    const saveResult =
      saveLocal(updated)

    if (saveResult?.error) {
      return saveResult
    }

    return {
      id,
      deleted: true,
    }
  },

  // ----------------------------------------------------------
  // Activar / desactivar acceso
  // ----------------------------------------------------------

  async toggleAccess(id, current) {
    const participants = loadLocal()

    if (participants?.error) {
      return participants
    }

    const exists =
      participants.some(
        p => p.id === id
      )

    if (!exists) {
      return createError(
        'El participante no existe.',
        'PARTICIPANT_NOT_FOUND'
      )
    }

    const patch =
      current.access
        ? {
            access: false,
          }
        : {
            access: true,
            fecha: todayISO(),
          }

    const updated =
      participants.map(p =>
        p.id === id
          ? {
              ...p,
              ...patch,
            }
          : p
      )

    const saveResult =
      saveLocal(updated)

    if (saveResult?.error) {
      return saveResult
    }

    return patch
  },

  // ----------------------------------------------------------
  // Renovar acceso
  // ----------------------------------------------------------

  async renewAccess(id) {
    const participants = loadLocal()

    if (participants?.error) {
      return participants
    }

    const exists =
      participants.some(
        p => p.id === id
      )

    if (!exists) {
      return createError(
        'El participante no existe.',
        'PARTICIPANT_NOT_FOUND'
      )
    }

    const patch = {
      access: true,
      fecha: todayISO(),
    }

    const updated =
      participants.map(p =>
        p.id === id
          ? {
              ...p,
              ...patch,
            }
          : p
      )

    const saveResult =
      saveLocal(updated)

    if (saveResult?.error) {
      return saveResult
    }

    return patch
  },

  // ----------------------------------------------------------
  // Importar
  // ----------------------------------------------------------

  async import(list) {
    const participants = loadLocal()

    if (participants?.error) {
      return participants
    }

    const newParticipants =
      list.map((imp, i) => ({
        id:
          'p' +
          Date.now() +
          i,
        name:
          imp.name ||
          'Sin nombre',
        email:
          imp.email ||
          null,
        phone:
          imp.phone ||
          '',
        cedula:
          imp.cedula ||
          '',
        courses:
          imp.courses ||
          [],
        tags:
          imp.tags ||
          [],
        status:
          'activo',
        payment:
          'pendiente',
        access:
          false,
        fecha:
          imp.fecha ||
          todayISO(),
        notes:
          imp.notes ||
          'Importado desde CSV',
      }))

    const saveResult =
      saveLocal([
        ...participants,
        ...newParticipants,
      ])

    if (saveResult?.error) {
      return saveResult
    }

    return {
      participants:
        newParticipants,
      errors: [],
    }
  },

  // ----------------------------------------------------------
  // Actualización masiva
  // ----------------------------------------------------------

  async bulkUpdate(
    ids,
    patch = {},
    addCourses = []
  ) {
    if (!ids?.length) {
      return []
    }

    const unsupportedFields =
      Object.keys(patch).filter(
        key => !['payment', 'access', 'fecha'].includes(key)
      )

    if (unsupportedFields.length) {
      return createError(
        'La actualización incluye campos no permitidos.',
        'PARTICIPANTS_BULK_INVALID_PATCH'
      )
    }

    const participants = loadLocal()

    if (participants?.error) {
      return participants
    }

    const updated =
      participants.map(p => {
        if (!ids.includes(p.id)) {
          return p
        }

        const newCourses = [
          ...new Set([
            ...(p.courses || []),
            ...addCourses,
          ]),
        ]

        return {
          ...p,
          ...patch,
          courses:
            newCourses,
        }
      })

    const saveResult =
      saveLocal(updated)

    if (saveResult?.error) {
      return saveResult
    }

    return updated.filter(
      p => ids.includes(p.id)
    )
  },

}

import { STORAGE_KEY, DEFAULT_PARTICIPANTS } from '../../data/constants.js'
import { todayISO } from '../../utils/time.js'

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    return raw
      ? JSON.parse(raw)
      : structuredClone(DEFAULT_PARTICIPANTS)

  } catch {
    return structuredClone(DEFAULT_PARTICIPANTS)
  }
}

function saveLocal(participants) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(participants)
  )
}

export const participantsLocalAdapter = {

  async getAll() {
    return loadLocal()
  },

  async add(form) {
    const participants = loadLocal()

    const participant = {
      id: 'p' + Date.now(),
      ...form,
      tags: form.tags || [],
      courses: form.courses || [],
      notes: form.notes || '',
      fecha: form.fecha || todayISO(),
    }

    saveLocal([
      ...participants,
      participant,
    ])

    return participant
  },

  async update(id, form) {
    const participants = loadLocal()

    const updated = participants.map(p =>
      p.id === id
        ? {
            ...p,
            ...form,
            tags: form.tags || p.tags || [],
            courses: form.courses || p.courses || [],
          }
        : p
    )

    saveLocal(updated)

    return updated.find(p => p.id === id)
  },

  async remove(id) {
    const participants = loadLocal()

    saveLocal(
      participants.filter(p => p.id !== id)
    )
  },

  async toggleAccess(id, current) {
    const participants = loadLocal()

    const patch = current.access
      ? { access: false }
      : {
          access: true,
          fecha: todayISO(),
        }

    const updated = participants.map(p =>
      p.id === id
        ? { ...p, ...patch }
        : p
    )

    saveLocal(updated)

    return patch
  },

  async renewAccess(id) {
    const participants = loadLocal()

    const patch = {
      access: true,
      fecha: todayISO(),
    }

    const updated = participants.map(p =>
      p.id === id
        ? { ...p, ...patch }
        : p
    )

    saveLocal(updated)

    return patch
  },

  async import(list) {
    const participants = loadLocal()

    const newParticipants = list.map((imp, i) => ({
      id: 'p' + Date.now() + i,
      name: imp.name || 'Sin nombre',
      email: imp.email || null,
      phone: imp.phone || '',
      cedula: imp.cedula || '',
      courses: imp.courses || [],
      tags: imp.tags || [],
      status: 'activo',
      payment: 'pendiente',
      access: false,
      fecha: imp.fecha || todayISO(),
      notes: imp.notes || 'Importado desde CSV',
    }))

    saveLocal([
      ...participants,
      ...newParticipants,
    ])

    return {
      participants: newParticipants,
      errors: [],
    }
  },

  async bulkUpdate(ids, patch = {}, addCourses = []) {
    const participants = loadLocal()

    const updated = participants.map(p => {
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
        courses: newCourses,
      }
    })

    saveLocal(updated)

    return updated.filter(p =>
      ids.includes(p.id)
    )
  },
}
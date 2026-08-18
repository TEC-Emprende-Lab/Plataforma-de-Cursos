// ============================================================
// tagsLocalAdapter.js
// Persistencia local de etiquetas mediante localStorage.
// ============================================================

import {
  DEFAULT_TAGS,
  TAGS_STORAGE_KEY,
} from '../../data/tags.js'

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
      localStorage.getItem(TAGS_STORAGE_KEY)

    return raw
      ? JSON.parse(raw)
      : structuredClone(DEFAULT_TAGS)

  } catch (error) {
    console.error(
      '[tagsLocalAdapter] loadLocal',
      error
    )

    return createError(
      'No se pudieron cargar las etiquetas.',
      'TAGS_LOAD_ERROR'
    )
  }
}

function saveLocal(tags) {
  try {
    localStorage.setItem(
      TAGS_STORAGE_KEY,
      JSON.stringify(tags)
    )

    return null
  } catch (error) {
    console.error(
      '[tagsLocalAdapter] saveLocal',
      error
    )

    return createError(
      'No se pudieron guardar las etiquetas.',
      'TAGS_SAVE_ERROR'
    )
  }
}

// ============================================================
// Adapter
// ============================================================

export const tagsLocalAdapter = {

  // ----------------------------------------------------------
  // Obtener etiquetas
  // ----------------------------------------------------------

  async getAll() {
    return loadLocal()
  },

  // ----------------------------------------------------------
  // Agregar
  // ----------------------------------------------------------

  async add(name, color) {
    const tags = loadLocal()

    if (tags?.error) {
      return tags
    }

    const tag = {
      id: 't' + Date.now(),
      name,
      color,
    }

    const saveResult =
      saveLocal([
        ...tags,
        tag,
      ])

    if (saveResult?.error) {
      return saveResult
    }

    return tag
  },

  // ----------------------------------------------------------
  // Actualizar
  // ----------------------------------------------------------

  async update(id, name, color) {
    const tags = loadLocal()

    if (tags?.error) {
      return tags
    }

    const currentTag =
      tags.find(tag => tag.id === id)

    if (!currentTag) {
      return createError(
        'La etiqueta no existe.',
        'TAG_NOT_FOUND'
      )
    }

    const updatedTag = {
      ...currentTag,
      name,
      color,
    }

    const updated = tags.map(tag =>
      tag.id === id
        ? updatedTag
        : tag
    )

    const saveResult =
      saveLocal(updated)

    if (saveResult?.error) {
      return saveResult
    }

    return updatedTag
  },

  // ----------------------------------------------------------
  // Eliminar
  // ----------------------------------------------------------

  async remove(id) {
    const tags = loadLocal()

    if (tags?.error) {
      return tags
    }

    const exists =
      tags.some(tag => tag.id === id)

    if (!exists) {
      return createError(
        'La etiqueta no existe.',
        'TAG_NOT_FOUND'
      )
    }

    const updated =
      tags.filter(tag => tag.id !== id)

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
}
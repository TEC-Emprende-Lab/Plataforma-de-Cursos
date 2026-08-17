import { DEFAULT_TAGS, TAGS_STORAGE_KEY } from '../../data/tags.js'

function loadLocal() {
  try {
    const raw = localStorage.getItem(TAGS_STORAGE_KEY)

    return raw
      ? JSON.parse(raw)
      : structuredClone(DEFAULT_TAGS)
  } catch {
    return structuredClone(DEFAULT_TAGS)
  }
}

function saveLocal(tags) {
  localStorage.setItem(
    TAGS_STORAGE_KEY,
    JSON.stringify(tags)
  )
}

export const tagsLocalAdapter = {

  async getAll() {
    return loadLocal()
  },

  async add(name, color) {
    const tags = loadLocal()

    const tag = {
      id: 't' + Date.now(),
      name,
      color,
    }

    saveLocal([
      ...tags,
      tag,
    ])

    return tag
  },

  async update(id, name, color) {
    const tags = loadLocal()

    const updated = tags.map(tag =>
      tag.id === id
        ? { ...tag, name, color }
        : tag
    )

    saveLocal(updated)

    return updated.find(tag => tag.id === id)
  },

  async remove(id) {
    const tags = loadLocal()

    saveLocal(
      tags.filter(tag => tag.id !== id)
    )
  },
}
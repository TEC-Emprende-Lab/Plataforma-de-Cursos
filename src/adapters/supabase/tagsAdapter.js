import { supabase } from '../../lib/supabase.js'
import { validateTag } from '../../utils/validators.js'

const TAG_SELECT = 'id,name,color'

// ============================================================
// Helpers
// ============================================================

function fromSupabaseError(error, fallbackCode) {
  return {
    error: {
      message:
        error?.message ??
        'Ocurrió un error en Supabase.',
      code:
        error?.code ??
        fallbackCode,
    },
  }
}

/** Carga la lista actual para validar duplicados igual que en modo local. */
async function fetchTags() {
  const { data, error } =
    await supabase
      .from('tags')
      .select(TAG_SELECT)
      .order('name')

  if (error) {
    return fromSupabaseError(
      error,
      'TAGS_LOAD_ERROR'
    )
  }

  return data || []
}

// ============================================================
// Adapter
// ============================================================

export const tagsSupabaseAdapter = {

  // ----------------------------------------------------------
  // Obtener etiquetas
  // ----------------------------------------------------------

  async getAll() {
    const { data, error } =
      await supabase
        .from('tags')
        .select(TAG_SELECT)
        .order('name')

    if (error) {
      return fromSupabaseError(
        error,
        'TAGS_LOAD_ERROR'
      )
    }

    return data || []
  },

  // ----------------------------------------------------------
  // Agregar
  // ----------------------------------------------------------

  async add(name, color) {
    const tags = await fetchTags()

    if (tags?.error) {
      return tags
    }

    const check = validateTag(name, tags)
    if (check.error) {
      return check
    }

    const { data, error } =
      await supabase
        .from('tags')
        .insert({
          name: check.name,
          color,
        })
        .select(TAG_SELECT)
        .single()

    if (error) {
      return fromSupabaseError(
        error,
        'TAG_CREATE_ERROR'
      )
    }

    return data
  },

  // ----------------------------------------------------------
  // Actualizar
  // ----------------------------------------------------------

  async update(id, name, color) {
    const tags = await fetchTags()

    if (tags?.error) {
      return tags
    }

    const check = validateTag(name, tags, id)
    if (check.error) {
      return check
    }

    const { data, error } =
      await supabase
        .from('tags')
        .update({
          name: check.name,
          color,
        })
        .eq('id', id)
        .select(TAG_SELECT)
        .single()

    if (error) {
      return fromSupabaseError(
        error,
        'TAG_UPDATE_ERROR'
      )
    }

    return data
  },

  // ----------------------------------------------------------
  // Eliminar
  // ----------------------------------------------------------

  async remove(id) {
    const { data, error } =
      await supabase
        .from('tags')
        .delete()
        .eq('id', id)
        .select('id')

    if (error) {
      return fromSupabaseError(
        error,
        'TAG_DELETE_ERROR'
      )
    }

    if (!data || data.length === 0) {
      return {
        error: {
          message:
            'La etiqueta no existe.',
          code:
            'TAG_NOT_FOUND',
        },
      }
    }

    return {
      id,
      deleted: true,
    }
  },
}
// ============================================================
// coursesSupabaseAdapter.js
// Persistencia de cursos mediante Supabase.
//
// Mantiene el mismo contrato que el adapter local.
//
// Contrato:
//   - Éxito con entidad → entidad
//   - Éxito sin entidad → resultado explícito
//   - Error → { error: { message, code } }
// ============================================================

import { supabase } from '../../lib/supabase.js'

// ============================================================
// Helpers
// ============================================================

function fromDb(row) {
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    short: row.short ?? '',
    type: row.type,
    platform: row.platform ?? '',
    start: row.start_date ?? '',
    end: row.end_date ?? '',
    capacity: row.capacity ?? 0,
    price:
      row.price != null
        ? String(row.price)
        : '0',
    modalidad:
      row.modalidad ?? 'Asincrónico',
    code: row.code ?? '',
    description:
      row.description ?? '',
    active:
      row.active ?? true,
    accessDays:
      row.access_days != null
        ? Number(row.access_days)
        : 45,
    certEnabled:
      row.cert_enabled ?? false,
  }
}

function toDb(form) {
  return {
    name: form.name ?? null,
    short: form.short ?? null,
    type: form.type ?? 'curso',
    platform: form.platform ?? null,
    start_date: form.start || null,
    end_date: form.end || null,
    capacity:
      form.capacity != null
        ? Number(form.capacity)
        : null,
    price:
      form.price !== '' &&
      form.price != null
        ? Number(form.price)
        : null,
    modalidad:
      form.modalidad ?? null,
    code:
      form.code || null,
    description:
      form.description ?? null,
    active:
      form.active ?? true,
    access_days:
      form.accessDays != null
        ? Number(form.accessDays)
        : 45,
    cert_enabled:
      form.certEnabled ?? false,
  }
}

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

// ============================================================
// Adapter
// ============================================================

export const coursesSupabaseAdapter = {

  // ----------------------------------------------------------
  // Obtener cursos
  // ----------------------------------------------------------

  async getCourses() {
    const { data, error } =
      await supabase
        .from('courses')
        .select('*')
        .order('start_date', {
          ascending: true,
        })

    if (error) {
      return fromSupabaseError(
        error,
        'COURSES_LOAD_ERROR'
      )
    }

    return (data || []).map(fromDb)
  },

  // ----------------------------------------------------------
  // Agregar curso
  // ----------------------------------------------------------

  async addCourse(form) {
    const { data, error } =
      await supabase
        .from('courses')
        .insert(
          toDb({
            active: true,
            ...form,
          })
        )
        .select('*')
        .single()

    if (error) {
      return fromSupabaseError(
        error,
        'COURSE_CREATE_ERROR'
      )
    }

    return fromDb(data)
  },

  // ----------------------------------------------------------
  // Actualizar curso
  // ----------------------------------------------------------

  async updateCourse(id, form) {
    const { data, error } =
      await supabase
        .from('courses')
        .update(toDb(form))
        .eq('id', id)
        .select('*')
        .single()

    if (error) {
      return fromSupabaseError(
        error,
        'COURSE_UPDATE_ERROR'
      )
    }

    return fromDb(data)
  },

  // ----------------------------------------------------------
  // Eliminar curso
  // ----------------------------------------------------------

  async deleteCourse(id) {
    const { data, error } =
      await supabase
        .from('courses')
        .delete()
        .eq('id', id)
        .select('id')

    if (error) {
      return fromSupabaseError(
        error,
        'COURSE_DELETE_ERROR'
      )
    }

    if (!data || data.length === 0) {
      return {
        error: {
          message:
            'El curso no existe.',
          code:
            'COURSE_NOT_FOUND',
        },
      }
    }

    return {
      id,
      deleted: true,
    }
  },

  // ----------------------------------------------------------
  // Activar / desactivar curso
  // ----------------------------------------------------------

  async toggleActive(id, active) {
    const { data, error } =
      await supabase
        .from('courses')
        .update({ active })
        .eq('id', id)
        .select('*')
        .single()

    if (error) {
      return fromSupabaseError(
        error,
        'COURSE_TOGGLE_ERROR'
      )
    }

    return fromDb(data)
  },

}
import { supabase } from '../../lib/supabase.js'
import { normalizeCedula } from '../../utils/cedula.js'
import { todayISO } from '../../utils/time.js'

const PARTICIPANT_SELECT =
  'id,name,cedula,email,phone,status,payment,access,fecha,notes,' +
  'participant_courses(course_id),participant_tags(tag_id)'

// ============================================================
// Helpers
// ============================================================

function fromDb(row) {
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    cedula: row.cedula ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    status: row.status,
    payment: row.payment,
    access: row.access,
    fecha: row.fecha ?? '',
    notes: row.notes ?? '',
    courses:
      (row.participant_courses || [])
        .map(x => x.course_id),
    tags:
      (row.participant_tags || [])
        .map(x => x.tag_id),
  }
}

function baseFromForm(form) {
  return {
    name: form.name ?? null,
    cedula:
      normalizeCedula(form.cedula) || null,
    email: form.email ?? null,
    phone: form.phone ?? null,
    status:
      form.status ?? 'activo',
    payment:
      form.payment ?? 'pendiente',
    access:
      form.access ?? false,
    fecha:
      form.fecha || null,
    notes:
      form.notes ?? null,
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
// Operaciones con relaciones
// ============================================================

async function createParticipantWithRelations(form) {
  const base = baseFromForm(form)

  const { data, error } =
    await supabase.rpc(
      'create_participant_with_relations',
      {
        p_name: base.name,
        p_cedula: base.cedula,
        p_email: base.email,
        p_phone: base.phone,
        p_status: base.status,
        p_payment: base.payment,
        p_access: base.access,
        p_fecha: base.fecha,
        p_notes: base.notes,
        p_course_ids:
          form.courses || [],
        p_tag_ids:
          form.tags || [],
      }
    )

  if (error) {
    return fromSupabaseError(
      error,
      'PARTICIPANT_CREATE_ERROR'
    )
  }

  return data
}

async function updateParticipantWithRelations(
  id,
  form
) {
  const base = baseFromForm(form)

  const { error } =
    await supabase.rpc(
      'update_participant_with_relations',
      {
        p_participant_id: id,
        p_name: base.name,
        p_cedula: base.cedula,
        p_email: base.email,
        p_phone: base.phone,
        p_status: base.status,
        p_payment: base.payment,
        p_access: base.access,
        p_fecha: base.fecha,
        p_notes: base.notes,
        p_course_ids:
          form.courses || [],
        p_tag_ids:
          form.tags || [],
      }
    )

  if (error) {
    return fromSupabaseError(
      error,
      'PARTICIPANT_UPDATE_ERROR'
    )
  }

  return null
}

async function fetchOne(id) {
  const { data, error } =
    await supabase
      .from('participants')
      .select(PARTICIPANT_SELECT)
      .eq('id', id)
      .single()

  if (error) {
    return fromSupabaseError(
      error,
      'PARTICIPANT_LOAD_ERROR'
    )
  }

  return fromDb(data)
}

// ============================================================
// Adapter
// ============================================================

export const participantsSupabaseAdapter = {

  // ----------------------------------------------------------
  // Obtener todos
  // ----------------------------------------------------------

  async getAll() {
    const { data, error } =
      await supabase
        .from('participants')
        .select(PARTICIPANT_SELECT)
        .order('name')

    if (error) {
      return fromSupabaseError(
        error,
        'PARTICIPANTS_LOAD_ERROR'
      )
    }

    return (data || []).map(fromDb)
  },

  // ----------------------------------------------------------
  // Agregar
  // ----------------------------------------------------------

  async add(form) {
    const id =
      await createParticipantWithRelations(
        form
      )

    if (id?.error) {
      return id
    }

    const participant =
      await fetchOne(id)

    if (participant?.error) {
      return participant
    }

    return participant
  },

  // ----------------------------------------------------------
  // Actualizar
  // ----------------------------------------------------------

  async update(id, form) {
    const updateResult =
      await updateParticipantWithRelations(
        id,
        form
      )

    if (updateResult?.error) {
      return updateResult
    }

    const participant =
      await fetchOne(id)

    if (participant?.error) {
      return participant
    }

    return participant
  },

  // ----------------------------------------------------------
  // Eliminar
  // ----------------------------------------------------------

  async remove(id) {
    const { data, error } =
      await supabase
        .from('participants')
        .delete()
        .eq('id', id)
        .select('id')

    if (error) {
      return fromSupabaseError(
        error,
        'PARTICIPANT_DELETE_ERROR'
      )
    }

    if (!data || data.length === 0) {
      return {
        error: {
          message:
            'El participante no existe.',
          code:
            'PARTICIPANT_NOT_FOUND',
        },
      }
    }

    return {
      id,
      deleted: true,
    }
  },

  // ----------------------------------------------------------
  // Toggle access
  // ----------------------------------------------------------

  async toggleAccess(id, current) {
    const patch = current.access
      ? {
          access: false,
        }
      : {
          access: true,
          fecha: todayISO(),
        }

    const { data, error } =
      await supabase
        .from('participants')
        .update(patch)
        .eq('id', id)
        .select('id')

    if (error) {
      return fromSupabaseError(
        error,
        'PARTICIPANT_ACCESS_ERROR'
      )
    }

    if (!data || data.length === 0) {
      return {
        error: {
          message:
            'El participante no existe.',
          code:
            'PARTICIPANT_NOT_FOUND',
        },
      }
    }

    return patch
  },

  // ----------------------------------------------------------
  // Renovar acceso
  // ----------------------------------------------------------

  async renewAccess(id) {
    const patch = {
      access: true,
      fecha: todayISO(),
    }

    const { data, error } =
      await supabase
        .from('participants')
        .update(patch)
        .eq('id', id)
        .select('id')

    if (error) {
      return fromSupabaseError(
        error,
        'PARTICIPANT_RENEW_ERROR'
      )
    }

    if (!data || data.length === 0) {
      return {
        error: {
          message:
            'El participante no existe.',
          code:
            'PARTICIPANT_NOT_FOUND',
        },
      }
    }

    return patch
  },

  // ----------------------------------------------------------
  // Importar
  //
  // Excepción legítima:
  //
  // Si falla antes del batch:
  //   { error: { message, code } }
  //
  // Si el batch corre y algunos elementos fallan:
  //   { participants, errors }
  // ----------------------------------------------------------

  async import(list) {
    const added = []
    const errors = []

    for (const imp of list) {
      const form = {
        name:
          imp.name || 'Sin nombre',
        cedula:
          imp.cedula || null,
        email:
          imp.email || null,
        phone:
          imp.phone || null,
        status:
          'activo',
        payment:
          'pendiente',
        access:
          false,
        fecha:
          imp.fecha || todayISO(),
        notes:
          imp.notes ||
          'Importado desde CSV',
        courses:
          imp.courses || [],
        tags:
          imp.tags || [],
      }

      const id =
        await createParticipantWithRelations(
          form
        )

      if (id?.error) {
        console.error(
          '[participantsAdapter] import',
          imp.name,
          id.error
        )

        errors.push({
          name:
            imp.name || 'Sin nombre',
          message:
            id.error.message,
          code:
            id.error.code,
        })

        continue
      }

      const fresh =
        await fetchOne(id)

      if (fresh?.error) {
        console.error(
          '[participantsAdapter] import',
          imp.name,
          fresh.error
        )

        errors.push({
          name:
            imp.name || 'Sin nombre',
          message:
            fresh.error.message,
          code:
            fresh.error.code,
        })

        continue
      }

      if (fresh) {
        added.push(fresh)
      }
    }

    return {
      participants: added,
      errors,
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
      return {
        error: {
          message:
            'La actualización incluye campos no permitidos.',
          code:
            'PARTICIPANTS_BULK_INVALID_PATCH',
        },
      }
    }

    const { error } =
      await supabase.rpc(
        'bulk_update_participants_with_courses',
        {
          p_participant_ids: ids,
          p_payment:
            patch.payment ?? null,
          p_access:
            patch.access ?? null,
          p_fecha:
            patch.fecha ?? null,
          p_course_ids:
            addCourses,
        }
      )

    if (error) {
      return fromSupabaseError(
        error,
        'PARTICIPANTS_BULK_UPDATE_ERROR'
      )
    }

    // --------------------------------------------------------
    // Obtener participantes actualizados
    // --------------------------------------------------------

    const refreshed = []

    for (const id of ids) {
      const participant =
        await fetchOne(id)

      if (participant?.error) {
        return participant
      }

      if (participant) {
        refreshed.push(participant)
      }
    }

    return refreshed
  },
}

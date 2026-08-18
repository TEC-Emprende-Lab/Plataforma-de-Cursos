import { supabase } from '../../lib/supabase.js'
import { normalizeCedula } from '../../utils/cedula.js'
import { todayISO } from '../../utils/time.js'

const PARTICIPANT_SELECT =
  'id,name,cedula,email,phone,status,payment,access,fecha,notes,' +
  'participant_courses(course_id),participant_tags(tag_id)'

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
    courses: (row.participant_courses || []).map(x => x.course_id),
    tags: (row.participant_tags || []).map(x => x.tag_id),
  }
}

function baseFromForm(form) {
  return {
    name: form.name ?? null,
    cedula: normalizeCedula(form.cedula) || null,
    email: form.email ?? null,
    phone: form.phone ?? null,
    status: form.status ?? 'activo',
    payment: form.payment ?? 'pendiente',
    access: form.access ?? false,
    fecha: form.fecha || null,
    notes: form.notes ?? null,
  }
}

async function createParticipantWithRelations(form) {
  const base = baseFromForm(form)

  const { data, error } = await supabase.rpc(
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
      p_course_ids: form.courses || [],
      p_tag_ids: form.tags || [],
    }
  )

  if (error) throw error

  // la función SQL retorna el uuid del participante creado
  return data
}

async function updateParticipantWithRelations(id, form) {
  const base = baseFromForm(form)

  const { error } = await supabase.rpc(
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
      p_course_ids: form.courses || [],
      p_tag_ids: form.tags || [],
    }
  )

  if (error) throw error
}

async function fetchOne(id) {
  const { data, error } = await supabase
    .from('participants')
    .select(PARTICIPANT_SELECT)
    .eq('id', id)
    .single()

  if (error) throw error

  return fromDb(data)
}

export const participantsSupabaseAdapter = {

  async getAll() {
    const { data, error } = await supabase
      .from('participants')
      .select(PARTICIPANT_SELECT)
      .order('name')

    if (error) throw error

    return (data || []).map(fromDb)
  },

  async add(form) {
    const id = await createParticipantWithRelations(form)

    return fetchOne(id)
  },

  async update(id, form) {
    await updateParticipantWithRelations(id, form)

    return fetchOne(id)
  },

  async remove(id) {
    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async toggleAccess(id, current) {
    const patch = current.access
      ? { access: false }
      : {
          access: true,
          fecha: todayISO(),
        }

    const { error } = await supabase
      .from('participants')
      .update(patch)
      .eq('id', id)

    if (error) throw error

    return patch
  },

  async renewAccess(id) {
    const patch = {
      access: true,
      fecha: todayISO(),
    }

    const { error } = await supabase
      .from('participants')
      .update(patch)
      .eq('id', id)

    if (error) throw error

    return patch
  },

  async import(list) {
    const added = []
    const errors = []

    for (const imp of list) {
      const form = {
        name: imp.name || 'Sin nombre',
        cedula: imp.cedula || null,
        email: imp.email || null,
        phone: imp.phone || null,
        status: 'activo',
        payment: 'pendiente',
        access: false,
        fecha: imp.fecha || todayISO(),
        notes: imp.notes || 'Importado desde CSV',
        courses: imp.courses || [],
        tags: imp.tags || [],
      }

      try {
        // Usa el RPC: crea participante + relaciones (cursos/tags) en una
        // sola transacción atómica. Si algo falla (ej. tag inválido),
        // el participante tampoco queda creado a medias.
        const id = await createParticipantWithRelations(form)

        const fresh = await fetchOne(id)

        if (fresh) {
          added.push(fresh)
        }

      } catch (error) {
        console.error(
          '[participantsAdapter] import',
          imp.name,
          error
        )

        errors.push({
          name: imp.name || 'Sin nombre',
          message:
            error.message ||
            error.code ||
            'error desconocido',
        })
      }
    }

    return {
      participants: added,
      errors,
    }
  },

  async bulkUpdate(ids, patch = {}, addCourses = []) {
    if (!ids?.length) {
      return []
    }

    if (Object.keys(patch).length) {
      const { error } = await supabase
        .from('participants')
        .update(patch)
        .in('id', ids)

      if (error) throw error
    }

    if (addCourses.length) {
      const rows = ids.flatMap(pid =>
        addCourses.map(cid => ({
          participant_id: pid,
          course_id: cid,
        }))
      )

      const { error } = await supabase
        .from('participant_courses')
        .upsert(rows, {
          onConflict: 'participant_id,course_id',
        })

      if (error) throw error
    }

    const refreshed = []

    for (const id of ids) {
      const participant = await fetchOne(id)

      if (participant) {
        refreshed.push(participant)
      }
    }

    return refreshed
  },
}
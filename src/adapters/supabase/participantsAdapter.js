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

async function syncRelations(participantId, courses, tags) {
  if (Array.isArray(courses)) {
    const { error: deleteError } = await supabase
      .from('participant_courses')
      .delete()
      .eq('participant_id', participantId)

    if (deleteError) throw deleteError

    if (courses.length) {
      const rows = courses.map(courseId => ({
        participant_id: participantId,
        course_id: courseId,
      }))

      const { error } = await supabase
        .from('participant_courses')
        .insert(rows)

      if (error) throw error
    }
  }

  if (Array.isArray(tags)) {
    const { error: deleteError } = await supabase
      .from('participant_tags')
      .delete()
      .eq('participant_id', participantId)

    if (deleteError) throw deleteError

    if (tags.length) {
      const rows = tags.map(tagId => ({
        participant_id: participantId,
        tag_id: tagId,
      }))

      const { error } = await supabase
        .from('participant_tags')
        .insert(rows)

      if (error) throw error
    }
  }
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
    const base = {
      ...baseFromForm(form),
      fecha: form.fecha || todayISO(),
    }

    const { data, error } = await supabase
      .from('participants')
      .insert(base)
      .select('id')
      .single()

    if (error) throw error

    await syncRelations(
      data.id,
      form.courses || [],
      form.tags || []
    )

    return fetchOne(data.id)
  },

  async update(id, form) {
    const { error } = await supabase
      .from('participants')
      .update(baseFromForm(form))
      .eq('id', id)

    if (error) throw error

    await syncRelations(
      id,
      form.courses,
      form.tags
    )

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
      const base = {
        name: imp.name || 'Sin nombre',
        cedula: normalizeCedula(imp.cedula) || null,
        email: imp.email || null,
        phone: imp.phone || null,
        status: 'activo',
        payment: 'pendiente',
        access: false,
        fecha: imp.fecha || todayISO(),
        notes: imp.notes || 'Importado desde CSV',
      }

      try {
        const { data, error } = await supabase
          .from('participants')
          .insert(base)
          .select('id')
          .single()

        if (error) throw error

        await syncRelations(
          data.id,
          imp.courses || [],
          imp.tags || []
        )

        const fresh = await fetchOne(data.id)

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
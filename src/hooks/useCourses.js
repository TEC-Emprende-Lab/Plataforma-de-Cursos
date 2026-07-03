// ============================================================
//  useCourses.js — Hook de cursos/talleres
//  Si Supabase está configurado: lee/escribe la tabla `courses`.
//  Si no: fallback localStorage.
//  API pública: { courses, addCourse, updateCourse, deleteCourse, toggleActive }.
//
//  Mapeo DB ↔ app:
//    DB.start_date  ↔  app.start
//    DB.end_date    ↔  app.end
//    DB.price (num) ↔  app.price (string para inputs)
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { COURSES_STORAGE_KEY, DEFAULT_COURSES } from '../data/courses.js'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

function fromDb(row) {
  if (!row) return null
  return {
    id:          row.id,
    name:        row.name,
    short:       row.short ?? '',
    type:        row.type,
    platform:    row.platform ?? '',
    start:       row.start_date ?? '',
    end:         row.end_date ?? '',
    capacity:    row.capacity ?? 0,
    price:       row.price != null ? String(row.price) : '0',
    modalidad:   row.modalidad ?? 'Asincrónico',
    code:        row.code ?? '',
    description: row.description ?? '',
    active:       row.active ?? true,
    accessDays:   row.access_days != null ? Number(row.access_days) : 45,
    certEnabled:  row.cert_enabled ?? false,
  }
}

function toDb(form) {
  return {
    name:        form.name ?? null,
    short:       form.short ?? null,
    type:        form.type ?? 'curso',
    platform:    form.platform ?? null,
    start_date:  form.start || null,
    end_date:    form.end || null,
    capacity:    form.capacity != null ? Number(form.capacity) : null,
    price:       form.price !== '' && form.price != null ? Number(form.price) : null,
    modalidad:   form.modalidad ?? null,
    code:        form.code || null,
    description: form.description ?? null,
    active:       form.active ?? true,
    access_days:  form.accessDays != null ? Number(form.accessDays) : 45,
    cert_enabled: form.certEnabled ?? false,
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(COURSES_STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_COURSES)
    const parsed = JSON.parse(raw)
    // Migración: asegurar que todos los cursos tengan accessDays
    return parsed.map(c => ({
      ...c,
      accessDays: c.accessDays != null ? Number(c.accessDays) : 45,
    }))
  } catch {
    return structuredClone(DEFAULT_COURSES)
  }
}

export function useCourses() {
  const [courses, setCourses] = useState(() => isSupabaseConfigured ? [] : loadLocal())

  useEffect(() => {
    if (isSupabaseConfigured) return
    localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(courses))
  }, [courses])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.from('courses').select('*').order('start_date', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[useCourses] fetch', error)
        else setCourses((data || []).map(fromDb))
      })
  }, [])

  const addCourse = useCallback(async (form) => {
    if (!isSupabaseConfigured) {
      const newCourse = {
        id:          'c' + Date.now(),
        name:        form.name        || 'Nuevo curso',
        short:       form.short       || form.name?.slice(0, 20) || 'Curso',
        type:        form.type        || 'curso',
        platform:    form.platform    || 'TEC Digital',
        start:       form.start       || '',
        end:         form.end         || '',
        capacity:    Number(form.capacity) || 30,
        price:       form.price       || '0',
        modalidad:   form.modalidad   || 'Asincrónico',
        code:        form.code        || '',
        description: form.description || '',
        active:      true,
        accessDays:  Number(form.accessDays) || 45,
        certEnabled: form.certEnabled ?? false,
      }
      setCourses(prev => [...prev, newCourse])
      return newCourse
    }
    const { data, error } = await supabase.from('courses')
      .insert(toDb({ active: true, ...form })).select('*').single()
    if (error) { console.error('[useCourses] add', error); return { error } }
    const mapped = fromDb(data)
    setCourses(prev => [...prev, mapped])
    return mapped
  }, [])

  const updateCourse = useCallback(async (id, form) => {
    if (!isSupabaseConfigured) {
      setCourses(prev => prev.map(c =>
        c.id === id ? { ...c, ...form, capacity: Number(form.capacity) || c.capacity, accessDays: Number(form.accessDays) || c.accessDays || 45 } : c
      ))
      return
    }
    const { data, error } = await supabase.from('courses')
      .update(toDb(form)).eq('id', id).select('*').single()
    if (error) { console.error('[useCourses] update', error); return { error } }
    const mapped = fromDb(data)
    setCourses(prev => prev.map(c => c.id === id ? mapped : c))
    return mapped
  }, [])

  /** Elimina el curso. En modo Supabase el FK cascade limpia
   *  participant_courses; el setParticipants opcional permite al
   *  caller refrescar la lista local también. */
  const deleteCourse = useCallback(async (id, setParticipants) => {
    if (!isSupabaseConfigured) {
      setCourses(prev => prev.filter(c => c.id !== id))
      if (setParticipants) {
        setParticipants(prev =>
          prev.map(p => ({ ...p, courses: p.courses.filter(cid => cid !== id) }))
        )
      }
      return
    }
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) { console.error('[useCourses] delete', error); return }
    setCourses(prev => prev.filter(c => c.id !== id))
    if (setParticipants) {
      setParticipants(prev =>
        prev.map(p => ({ ...p, courses: (p.courses || []).filter(cid => cid !== id) }))
      )
    }
  }, [])

  const toggleActive = useCallback(async (id) => {
    if (!isSupabaseConfigured) {
      setCourses(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c))
      return
    }
    const current = courses.find(c => c.id === id)
    if (!current) return
    const { data, error } = await supabase.from('courses')
      .update({ active: !current.active }).eq('id', id).select('*').single()
    if (error) { console.error('[useCourses] toggleActive', error); return }
    const mapped = fromDb(data)
    setCourses(prev => prev.map(c => c.id === id ? mapped : c))
  }, [courses])

  return { courses, addCourse, updateCourse, deleteCourse, toggleActive }
}

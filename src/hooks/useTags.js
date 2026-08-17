// ============================================================
//  useTags.js — Hook de etiquetas
//  Si Supabase está configurado: lee/escribe la tabla `tags`.
//  Si no: fallback localStorage (modo legacy).
//  API pública intacta: { tags, addTag, editTag, deleteTag }.
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_TAGS, TAGS_STORAGE_KEY } from '../data/tags.js'
import { supabase, storageMode } from '../lib/supabase.js'

function loadLocal() {
  try {
    const raw = localStorage.getItem(TAGS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : structuredClone(DEFAULT_TAGS)
  } catch {
    return structuredClone(DEFAULT_TAGS)
  }
}

export function useTags() {
  const [tags, setTags] = useState(() => storageMode=== 'supabase' ? [] : loadLocal())

  // Persistencia local en modo legacy
  useEffect(() => {
    if (storageMode=== 'supabase') return
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags))
  }, [tags])

  // Fetch inicial desde Supabase
  useEffect(() => {
    if (storageMode=== 'local') return
    supabase.from('tags').select('id,name,color').order('name')
      .then(({ data, error }) => {
        if (error) console.error('[useTags] fetch', error)
        else setTags(data || [])
      })
  }, [])

  const addTag = useCallback(async (name, color) => {
    if (storageMode=== 'local') {
      setTags(prev => [...prev, { id: 't' + Date.now(), name, color }])
      return
    }
    const { data, error } = await supabase.from('tags')
      .insert({ name, color }).select('id,name,color').single()
    if (error) { console.error('[useTags] add', error); return }
    setTags(prev => [...prev, data])
  }, [])

  const editTag = useCallback(async (id, name, color) => {
    if (storageMode=== 'local') {
      setTags(prev => prev.map(t => t.id === id ? { ...t, name, color } : t))
      return
    }
    const { data, error } = await supabase.from('tags')
      .update({ name, color }).eq('id', id).select('id,name,color').single()
    if (error) { console.error('[useTags] edit', error); return }
    setTags(prev => prev.map(t => t.id === id ? data : t))
  }, [])

  const deleteTag = useCallback(async (id, setParticipants) => {
    if (storageMode=== 'local') {
      setTags(prev => prev.filter(t => t.id !== id))
      if (setParticipants) {
        setParticipants(prev =>
          prev.map(p => ({ ...p, tags: (p.tags || []).filter(tid => tid !== id) }))
        )
      }
      return
    }
    const { error } = await supabase.from('tags').delete().eq('id', id)
    if (error) { console.error('[useTags] delete', error); return }
    setTags(prev => prev.filter(t => t.id !== id))
    // El FK on delete cascade ya limpia participant_tags en DB.
    // Refrescar participantes en memoria queda a cargo del consumidor.
    if (setParticipants) {
      setParticipants(prev =>
        prev.map(p => ({ ...p, tags: (p.tags || []).filter(tid => tid !== id) }))
      )
    }
  }, [])

  return { tags, addTag, editTag, deleteTag }
}

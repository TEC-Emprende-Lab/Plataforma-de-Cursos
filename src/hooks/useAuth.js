// ============================================================
//  useAuth.js — Hook de sesión Supabase
//  Si supabase no está configurado, retorna user=null sin
//  loading (modo legacy). signIn/signOut fallan con mensaje
//  claro en ese caso.
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { supabase, storageMode } from '../lib/supabase.js'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(
    storageMode === 'supabase'
  )

  useEffect(() => {
    if (storageMode === 'local') return

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password })
  }, [])

  const signOut = useCallback(async () => {
    if (storageMode === 'local') return { error: null }
    return supabase.auth.signOut()
  }, [])

  return { user, loading, signIn, signOut }
}

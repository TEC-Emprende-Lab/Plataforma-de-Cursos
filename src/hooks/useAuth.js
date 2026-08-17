// ============================================================
// useAuth.js — Hook de sesión
//
// La implementación de autenticación se delega al adapter
// correspondiente según VITE_STORAGE_MODE.
//
// API pública:
//   { user, loading, signIn, signOut }
// ============================================================

import {
  useEffect,
  useState,
  useCallback,
} from 'react'

import { storageMode } from '../lib/supabase.js'

import {
  authLocalAdapter,
} from '../adapters/local/authAdapter.js'

import {
  authSupabaseAdapter,
} from '../adapters/supabase/authAdapter.js'

// ============================================================
// Seleccionar adapter
// ============================================================

const authAdapter =
  storageMode === 'local'
    ? authLocalAdapter
    : authSupabaseAdapter

// ============================================================
// Hook
// ============================================================

export function useAuth() {

  const [user, setUser] = useState(null)

  const [loading, setLoading] = useState(
    storageMode === 'supabase'
  )

  // ----------------------------------------------------------
  // Obtener sesión inicial
  // ----------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    authAdapter
      .getSession()
      .then(session => {
        if (cancelled) return

        setUser(session?.user ?? null)
        setLoading(false)
      })
      .catch(error => {
        if (cancelled) return

        console.error(
          '[useAuth] getSession',
          error
        )

        setUser(null)
        setLoading(false)
      })

    // --------------------------------------------------------
    // Escuchar cambios de autenticación
    // --------------------------------------------------------

    const subscription =
      authAdapter.onAuthStateChange(session => {
        if (!cancelled) {
          setUser(session?.user ?? null)
        }
      })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  // ----------------------------------------------------------
  // Iniciar sesión
  // ----------------------------------------------------------

  const signIn = useCallback(
    async (email, password) => {
      try {
        return await authAdapter.signIn(
          email,
          password
        )
      } catch (error) {
        console.error(
          '[useAuth] signIn',
          error
        )

        return { error }
      }
    },
    []
  )

  // ----------------------------------------------------------
  // Cerrar sesión
  // ----------------------------------------------------------

  const signOut = useCallback(async () => {
    try {
      return await authAdapter.signOut()
    } catch (error) {
      console.error(
        '[useAuth] signOut',
        error
      )

      return { error }
    }
  }, [])

  // ----------------------------------------------------------
  // API pública
  // ----------------------------------------------------------

  return {
    user,
    loading,
    signIn,
    signOut,
  }
}
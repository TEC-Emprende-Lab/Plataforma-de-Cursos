// ============================================================
// useAuth.js — Hook de sesión
//
// La implementación de autenticación se delega al adapter
// correspondiente según VITE_STORAGE_MODE.
//
// API pública:
//   {
//     user,
//     loading,
//     signIn,
//     signOut,
//     signInLoading,
//     signOutLoading,
//     signInError,
//     signOutError
//   }
//
// Contrato de mutaciones:
//   Éxito con entidad -> entity
//   Éxito sin entidad -> objeto explícito
//   Error             -> { error: { message, code } }
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
// Helpers
// ============================================================

function normalizeError(
  error,
  fallbackMessage,
  fallbackCode
) {
  return {
    message:
      error?.message ||
      fallbackMessage,
    code:
      error?.code ||
      fallbackCode,
  }
}

// ============================================================
// Hook
// ============================================================

export function useAuth() {

  const [user, setUser] =
    useState(null)

  // ==========================================================
  // Estado de sesión inicial
  // ==========================================================

  const [loading, setLoading] =
    useState(
      storageMode === 'supabase'
    )

  // ==========================================================
  // Estado de signIn
  // ==========================================================

  const [signInLoading, setSignInLoading] =
    useState(false)

  const [signInError, setSignInError] =
    useState(null)

  // ==========================================================
  // Estado de signOut
  // ==========================================================

  const [signOutLoading, setSignOutLoading] =
    useState(false)

  const [signOutError, setSignOutError] =
    useState(null)

  // ==========================================================
  // Obtener sesión inicial
  // ==========================================================

  useEffect(() => {
    let cancelled = false

    const loadSession = async () => {

      try {
        const result =
          await authAdapter.getSession()

        if (cancelled) return

        if (result?.error) {
          console.error(
            '[useAuth] getSession',
            result.error
          )

          setUser(null)

          return
        }

        setUser(
          result?.user ?? null
        )

      } catch (error) {
        if (cancelled) return

        console.error(
          '[useAuth] getSession',
          error
        )

        setUser(null)

      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSession()

    // --------------------------------------------------------
    // Escuchar cambios de autenticación
    // --------------------------------------------------------

    let subscription

    try {
      subscription =
        authAdapter.onAuthStateChange(
          session => {
            if (!cancelled) {
              setUser(
                session?.user ?? null
              )
            }
          }
        )
    } catch (error) {
      if (!cancelled) {
        console.error(
          '[useAuth] onAuthStateChange',
          error
        )
      }
    }

    return () => {
      cancelled = true

      subscription?.unsubscribe()
    }
  }, [])

  // ==========================================================
  // Iniciar sesión
  // ==========================================================

  const signIn = useCallback(
    async (email, password) => {

      setSignInLoading(true)
      setSignInError(null)

      try {
        const result =
          await authAdapter.signIn(
            email,
            password
          )

        if (result?.error) {
          console.error(
            '[useAuth] signIn',
            result.error
          )

          setSignInError(
            result.error
          )

          return result
        }

        setUser(result)

        return result

      } catch (error) {
        console.error(
          '[useAuth] signIn',
          error
        )

        const normalizedError =
          normalizeError(
            error,
            'No se pudo iniciar sesión.',
            'AUTH_SIGN_IN_ERROR'
          )

        setSignInError(
          normalizedError
        )

        return {
          error: normalizedError,
        }

      } finally {
        setSignInLoading(false)
      }
    },
    []
  )

  // ==========================================================
  // Cerrar sesión
  // ==========================================================

  const signOut = useCallback(
    async () => {

      setSignOutLoading(true)
      setSignOutError(null)

      try {
        const result =
          await authAdapter.signOut()

        if (result?.error) {
          console.error(
            '[useAuth] signOut',
            result.error
          )

          setSignOutError(
            result.error
          )

          return result
        }

        setUser(null)

        return result

      } catch (error) {
        console.error(
          '[useAuth] signOut',
          error
        )

        const normalizedError =
          normalizeError(
            error,
            'No se pudo cerrar sesión.',
            'AUTH_SIGN_OUT_ERROR'
          )

        setSignOutError(
          normalizedError
        )

        return {
          error: normalizedError,
        }

      } finally {
        setSignOutLoading(false)
      }
    },
    []
  )

  // ==========================================================
  // API pública
  // ==========================================================

  return {
    user,
    loading,

    signIn,
    signOut,

    signInLoading,
    signOutLoading,

    signInError,
    signOutError,
  }
}
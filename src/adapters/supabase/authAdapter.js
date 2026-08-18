// ============================================================
// authAdapter.js — Autenticación mediante Supabase
//
// Implementa la autenticación utilizando Supabase Auth.
//
// Mantiene la misma API que el adapter local.
//
// Contrato:
//   - Éxito con entidad → entidad
//   - Éxito sin entidad → resultado explícito
//   - Error → { error: { message, code } }
// ============================================================

import { supabase } from '../../lib/supabase.js'

export const authSupabaseAdapter = {

  // ----------------------------------------------------------
  // Obtener sesión actual
  // ----------------------------------------------------------

  async getSession() {
    const { data, error } =
      await supabase.auth.getSession()

    if (error) {
      return {
        error: {
          message:
            error.message,
          code:
            error.code ??
            'AUTH_SESSION_ERROR',
        },
      }
    }

    return data.session ?? null
  },

  // ----------------------------------------------------------
  // Escuchar cambios de autenticación
  // ----------------------------------------------------------

  onAuthStateChange(callback) {
    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          callback(session)
        }
      )

    return subscription
  },

  // ----------------------------------------------------------
  // Iniciar sesión
  // ----------------------------------------------------------

  async signIn(email, password) {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (error) {
      return {
        error: {
          message:
            error.message,
          code:
            error.code ??
            'AUTH_SIGN_IN_ERROR',
        },
      }
    }

    return data.user
  },

  // ----------------------------------------------------------
  // Cerrar sesión
  // ----------------------------------------------------------

  async signOut() {
    const { error } =
      await supabase.auth.signOut()

    if (error) {
      return {
        error: {
          message:
            error.message,
          code:
            error.code ??
            'AUTH_SIGN_OUT_ERROR',
        },
      }
    }

    return {
      signedOut: true,
    }
  },

}
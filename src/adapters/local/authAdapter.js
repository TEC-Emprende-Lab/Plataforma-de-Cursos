// ============================================================
// authAdapter.js — Autenticación local
//
// En modo local no existe autenticación.
//
// Mantiene la misma API que el adapter de Supabase.
// ============================================================

export const authLocalAdapter = {

  // ----------------------------------------------------------
  // Obtener sesión
  // ----------------------------------------------------------

  async getSession() {
    return null
  },

  // ----------------------------------------------------------
  // Escuchar cambios de autenticación
  // ----------------------------------------------------------

  onAuthStateChange() {
    return {
      unsubscribe() {},
    }
  },

  // ----------------------------------------------------------
  // Iniciar sesión
  // ----------------------------------------------------------

  async signIn() {
    return {
      error: {
        message:
          'La autenticación no está disponible en modo local.',
        code: 'AUTH_UNAVAILABLE',
      },
    }
  },

  // ----------------------------------------------------------
  // Cerrar sesión
  // ----------------------------------------------------------

  async signOut() {
    return {
      signedOut: true,
    }
  },

}
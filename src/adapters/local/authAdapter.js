// ============================================================
// authAdapter.js — Autenticación local
//
// En modo local no existe autenticación.
// Mantiene la misma API que el adapter de Supabase.
// ============================================================

export const authLocalAdapter = {
  async getSession() {
    return null
  },

  onAuthStateChange() {
    return {
      unsubscribe() {},
    }
  },

  async signIn() {
    return {
      error: {
        message: 'La autenticación no está disponible en modo local.',
      },
    }
  },

  async signOut() {
    return {
      error: null,
    }
  },
}
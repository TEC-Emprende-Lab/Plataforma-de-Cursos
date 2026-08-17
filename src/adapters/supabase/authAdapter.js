// ============================================================
// authAdapter.js — Autenticación mediante Supabase
// ============================================================

import { supabase } from '../../lib/supabase.js'

export const authSupabaseAdapter = {

  async getSession() {
    const { data, error } =
      await supabase.auth.getSession()

    if (error) {
      throw error
    }

    return data.session ?? null
  },

  onAuthStateChange(callback) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        callback(session)
      }
    )

    return subscription
  },

  async signIn(email, password) {
    return supabase.auth.signInWithPassword({
      email,
      password,
    })
  },

  async signOut() {
    return supabase.auth.signOut()
  },
}
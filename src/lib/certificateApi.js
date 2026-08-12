import { isSupabaseConfigured, supabase } from './supabase.js'

export async function certificateApiFetch(input, init = {}) {
  const headers = new Headers(init.headers || {})

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    const token = data.session?.access_token
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, { ...init, headers })
}

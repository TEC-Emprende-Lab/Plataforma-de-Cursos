import { createClient } from '@supabase/supabase-js'
import { storageMode } from './config.js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

async function fetchWithJwtRetry(input, init) {
  const maxAttempts = 3
  let lastRes

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    lastRes = await fetch(input, init)

    if (lastRes.status !== 401) return lastRes

    try {
      const body = await lastRes.clone().json()

      if (body?.code !== 'PGRST303') return lastRes
    } catch {
      return lastRes
    }

    if (attempt === maxAttempts - 1) return lastRes

    await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
  }

  return lastRes
}

export { storageMode }

export const supabase =
  storageMode === 'supabase'
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
        global: {
          fetch: fetchWithJwtRetry,
        },
      })
    : null
import { afterEach, describe, expect, it, vi } from 'vitest'

async function validateWith(env) {
  vi.resetModules()

  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value)
  }

  const { validateConfig } = await import('./config.js')
  return validateConfig()
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('validateConfig', () => {
  it('rechaza un modo ausente o desconocido', async () => {
    const missing = await validateWith({ VITE_STORAGE_MODE: '' })
    expect(missing).toMatchObject({ valid: false })

    const invalid = await validateWith({ VITE_STORAGE_MODE: 'automatico' })
    expect(invalid).toMatchObject({ valid: false })
  })

  it('permite local únicamente en desarrollo', async () => {
    const development = await validateWith({
      VITE_STORAGE_MODE: 'local',
      PROD: false,
    })
    expect(development).toEqual({ valid: true, message: null })

    const production = await validateWith({
      VITE_STORAGE_MODE: 'local',
      PROD: true,
    })
    expect(production).toMatchObject({ valid: false })
  })

  it('exige las dos credenciales públicas al usar Supabase', async () => {
    const incomplete = await validateWith({
      VITE_STORAGE_MODE: 'supabase',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: '',
    })
    expect(incomplete).toMatchObject({ valid: false })

    const complete = await validateWith({
      VITE_STORAGE_MODE: 'supabase',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
    })
    expect(complete).toEqual({ valid: true, message: null })
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase.js', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}))

import { certificateApiFetch } from './certificateApi.js'
import { supabase } from './supabase.js'


describe('certificateApiFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('envía el access token de la sesión Supabase', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'signed-access-token' } },
      error: null,
    })
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await certificateApiFetch('https://certificates.example/api/generate', {
      method: 'POST',
      body: new FormData(),
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.get('Authorization')).toBe('Bearer signed-access-token')
    expect(init.headers.has('Content-Type')).toBe(false)
  })

  it('no inventa una credencial cuando todavía no hay sesión', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await certificateApiFetch('https://certificates.example/api/analyze', {
      method: 'POST',
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.has('Authorization')).toBe(false)
  })

  it('propaga el error de sesión y no realiza la solicitud', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: new Error('session unavailable'),
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      certificateApiFetch('https://certificates.example/api/preview')
    ).rejects.toThrow('session unavailable')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

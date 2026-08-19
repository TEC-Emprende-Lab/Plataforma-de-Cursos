import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
}))

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}))

import { participantsSupabaseAdapter } from './participantsAdapter.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.from.mockReturnValue({ select: mocks.select })
  mocks.select.mockReturnValue({ eq: mocks.eq })
  mocks.eq.mockReturnValue({ single: mocks.single })
})

describe('participantsSupabaseAdapter.bulkUpdate', () => {
  it('envía campos y cursos en una única RPC transaccional', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    mocks.single
      .mockResolvedValueOnce({
        data: {
          id: 'participant-1',
          name: 'Ana',
          participant_courses: [{ course_id: 'course-1' }],
          participant_tags: [],
        },
        error: null,
      })

    const result = await participantsSupabaseAdapter.bulkUpdate(
      ['participant-1'],
      { payment: 'pagado', access: true, fecha: '2026-08-19' },
      ['course-1']
    )

    expect(mocks.rpc).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith(
      'bulk_update_participants_with_courses',
      {
        p_participant_ids: ['participant-1'],
        p_payment: 'pagado',
        p_access: true,
        p_fecha: '2026-08-19',
        p_course_ids: ['course-1'],
      }
    )
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('participants')
    expect(result).toEqual([
      expect.objectContaining({
        id: 'participant-1',
        courses: ['course-1'],
      }),
    ])
  })

  it('no ejecuta cambios parciales si la RPC falla', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'rollback', code: '23503' },
    })

    const result = await participantsSupabaseAdapter.bulkUpdate(
      ['participant-1'],
      { payment: 'pagado' },
      ['missing-course']
    )

    expect(result).toEqual({
      error: { message: 'rollback', code: '23503' },
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rechaza campos fuera del contrato antes de llamar a Supabase', async () => {
    const result = await participantsSupabaseAdapter.bulkUpdate(
      ['participant-1'],
      { notes: 'fuera de alcance' },
      []
    )

    expect(result).toMatchObject({
      error: { code: 'PARTICIPANTS_BULK_INVALID_PATCH' },
    })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

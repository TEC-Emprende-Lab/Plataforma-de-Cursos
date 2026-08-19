/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '../../data/constants.js'
import { participantsLocalAdapter } from './participantsAdapter.js'

const participant = {
  id: 'participant-1',
  name: 'Ana',
  payment: 'pendiente',
  access: false,
  fecha: '2026-08-01',
  courses: [],
  tags: [],
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(STORAGE_KEY, JSON.stringify([participant]))
})

describe('participantsLocalAdapter.bulkUpdate', () => {
  it('aplica únicamente los campos y cursos permitidos por el contrato común', async () => {
    const result = await participantsLocalAdapter.bulkUpdate(
      [participant.id],
      { payment: 'pagado', access: true, fecha: '2026-08-19' },
      ['course-1']
    )

    expect(result).toEqual([
      expect.objectContaining({
        id: participant.id,
        payment: 'pagado',
        access: true,
        fecha: '2026-08-19',
        courses: ['course-1'],
      }),
    ])
  })

  it('rechaza campos fuera del contrato sin modificar localStorage', async () => {
    const before = localStorage.getItem(STORAGE_KEY)

    const result = await participantsLocalAdapter.bulkUpdate(
      [participant.id],
      { notes: 'fuera de alcance' }
    )

    expect(result).toEqual({
      error: {
        message: 'La actualización incluye campos no permitidos.',
        code: 'PARTICIPANTS_BULK_INVALID_PATCH',
      },
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })
})

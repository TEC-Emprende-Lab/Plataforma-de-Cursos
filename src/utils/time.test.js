import { beforeAll, describe, expect, it, vi } from 'vitest'

let time

beforeAll(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 7, 12, 12))
  vi.resetModules()
  time = await import('./time.js')
})

describe('cálculos de acceso', () => {
  it('cuenta días locales y limita fechas futuras a cero', () => {
    expect(time.daysElapsed('2026-08-02')).toBe(10)
    expect(time.daysElapsed('2026-08-20')).toBe(0)
  })

  it('calcula los límites de vigencia y advertencia', () => {
    expect(time.daysLeft('2026-08-02', 20)).toBe(10)
    expect(time.accessPct('2026-08-02', 20)).toBe(50)
    expect(time.isExpired('2026-07-23', 20)).toBe(true)
    expect(time.isWarning('2026-07-29', 20)).toBe(true)
    expect(time.needsExamReminder('2026-07-29', 20)).toBe(true)
  })

  it('resuelve la mayor duración entre los cursos matriculados', () => {
    const participant = { courses: ['short', 'long', 'missing'] }
    const courses = [
      { id: 'short', accessDays: 15 },
      { id: 'long', accessDays: '60' },
    ]

    expect(time.getAccessDays(participant, courses)).toBe(60)
    expect(time.getAccessDays({ courses: [] }, courses)).toBe(time.ACCESS_DAYS)
  })

  it('produce la fecha ISO local de hoy', () => {
    expect(time.todayISO()).toBe('2026-08-12')
  })
})

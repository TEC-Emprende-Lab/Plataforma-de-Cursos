import { beforeAll, describe, expect, it, vi } from 'vitest'

let buildReminderEmail

beforeAll(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 7, 12, 12))
  vi.resetModules()
  ;({ buildReminderEmail } = await import('./email.js'))
})

describe('buildReminderEmail', () => {
  it('construye el recordatorio con destinatario y nombres de cursos', () => {
    const participant = {
      name: 'Ana Rodríguez',
      email: 'ana@example.com',
      fecha: '2026-08-01',
      courses: ['c1', 'desconocido'],
    }
    const email = buildReminderEmail(participant, [{ id: 'c1', name: 'Finanzas' }])

    expect(email.to).toBe('ana@example.com')
    expect(email.from).toBe('tecemprendelab@itcr.ac.cr')
    expect(email.subject).toBe('Recordatorio: Realizá tu prueba final — Finanzas, desconocido')
    expect(email.body).toContain('Estimada/o Ana Rodríguez')
    expect(email.body).toContain('curso "Finanzas, desconocido"')
    expect(email.body).toContain('TEC Emprende Lab — ITCR')
  })

  it('calcula las fechas con los días de acceso del curso, no con el global de 45', () => {
    // Ingreso 2026-08-01; curso de 20 días:
    //   expira el 2026-08-21 y la prueba vence el 2026-08-14 (20 − 7).
    const participant = {
      name: 'Ana Rodríguez',
      email: 'ana@example.com',
      fecha: '2026-08-01',
      courses: ['c1'],
    }

    const email = buildReminderEmail(participant, [{ id: 'c1', name: 'Finanzas', accessDays: 20 }])
    expect(email.body).toContain('21 de agosto de 2026')
    expect(email.body).toContain('14 de agosto de 2026')
    // Con el fallback de 45 días habría dicho septiembre
    expect(email.body).not.toContain('septiembre')

    const sinCursos = buildReminderEmail(participant, [])
    expect(sinCursos.body).toContain('15 de septiembre de 2026')
  })
})

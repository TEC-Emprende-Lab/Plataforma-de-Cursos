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

  it('recalcula "hoy" en cada llamada al cruzar la medianoche', () => {
    vi.setSystemTime(new Date(2026, 7, 12, 23, 59))
    expect(time.daysElapsed('2026-08-12')).toBe(0)
    expect(time.isExpired('2026-08-12', 1)).toBe(false)

    vi.setSystemTime(new Date(2026, 7, 13, 0, 1))
    expect(time.daysElapsed('2026-08-12')).toBe(1)
    expect(time.isExpired('2026-08-12', 1)).toBe(true)

    vi.setSystemTime(new Date(2026, 7, 13, 23, 59))
    expect(time.todayISO()).toBe('2026-08-13')
  })

  it('clasifica los cuatro estados de acceso de forma consistente', () => {
    const courses = [{ id: 'c1', accessDays: 20 }]
    // Hoy simulado: 2026-08-12 → ingreso 2026-08-02 = 10 días transcurridos
    const vigente   = { fecha: '2026-08-02', access: true,  courses: ['c1'] }
    const porVencer = { fecha: '2026-07-29', access: true,  courses: ['c1'] } // quedan ≤7
    const expirado  = { fecha: '2026-07-20', access: true,  courses: ['c1'] } // 23 días > 20
    const sinAcceso = { fecha: '2026-08-02', access: false, courses: ['c1'] }

    expect(time.classifyAccess(vigente, courses)).toBe('vigente')
    expect(time.classifyAccess(porVencer, courses)).toBe('por_vencer')
    expect(time.classifyAccess(expirado, courses)).toBe('expirado')
    expect(time.classifyAccess(sinAcceso, courses)).toBe('sin_acceso')
    // Un vencido sin marca de acceso sigue siendo 'expirado', no 'sin_acceso'
    expect(time.classifyAccess({ ...expirado, access: false }, courses)).toBe('expirado')
  })

  it('revoca automáticamente según los días de cada curso y no persiste nada', () => {
    const courses = [
      { id: 'corto', accessDays: 10 },
      { id: 'largo', accessDays: 60 },
    ]
    const lista = [
      { id: 'a', fecha: '2026-07-25', access: true, courses: ['corto'] },  // 18 d > 10 → revocar
      { id: 'b', fecha: '2026-07-25', access: true, courses: ['largo'] },  // 18 d < 60 → conservar
      { id: 'c', fecha: '2026-07-25', access: false, courses: ['corto'] }, // ya revocado
      { id: 'd', fecha: '2026-08-02', access: true,  courses: [] },        // fallback 45 → conservar
    ]

    const next = time.applyAutoRevoke(lista, courses)

    expect(next.find(p => p.id === 'a').access).toBe(false)
    expect(next.find(p => p.id === 'b').access).toBe(true)
    expect(next.find(p => p.id === 'c').access).toBe(false)
    expect(next.find(p => p.id === 'd').access).toBe(true)
    // La lista original no se muta (solo estado en cliente)
    expect(lista.find(p => p.id === 'a').access).toBe(true)
    // Sin cursos cargados no revoca a nadie
    expect(time.applyAutoRevoke(lista, []).find(p => p.id === 'a').access).toBe(true)
    // Sin cambios devuelve la misma referencia
    const sinCambios = [lista[1], lista[2]]
    expect(time.applyAutoRevoke(sinCambios, courses)).toBe(sinCambios)
  })
})

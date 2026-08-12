import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildExcelBuffer, exportToExcel } from './export.js'
import { todayISO } from './time.js'

const participants = [{
  name: 'Ana Rodríguez',
  email: 'ana@example.com',
  phone: '8888-8888',
  courses: ['course-1', 'missing'],
  status: 'activo',
  payment: 'pagado',
  access: true,
  fecha: todayISO(),
  tags: ['emprendimiento'],
  notes: 'Seguimiento',
}]

const courses = [{ id: 'course-1', short: 'FIN', accessDays: 20 }]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('exportación Excel', () => {
  it('genera la hoja y columnas visibles con los datos transformados', async () => {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await buildExcelBuffer(participants, courses))

    const worksheet = workbook.getWorksheet('Participantes')
    expect(worksheet.rowCount).toBe(2)
    expect(worksheet.getRow(1).values.slice(1)).toEqual([
      'Nombre', 'Correo', 'Teléfono', 'Cursos', 'Estado', 'Pago',
      'Acceso activo', 'Fecha de ingreso', 'Días de acceso',
      'Días transcurridos', 'Días restantes', 'Fecha expiración',
      'Etiquetas', 'Notas',
    ])
    expect(worksheet.getRow(2).values.slice(1)).toEqual([
      'Ana Rodríguez', 'ana@example.com', '8888-8888', 'FIN, missing',
      'activo', 'pagado', 'Sí', todayISO(), 20, 0, 20,
      expect.any(String), 'emprendimiento', 'Seguimiento',
    ])
  })

  it('conserva una hoja vacía cuando no hay participantes', async () => {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await buildExcelBuffer([], courses))

    expect(workbook.getWorksheet('Participantes').rowCount).toBe(0)
  })

  it('descarga un archivo xlsx con el nombre solicitado', async () => {
    const click = vi.fn()
    const anchor = { click }
    const createObjectURL = vi.fn(() => 'blob:excel')
    const revokeObjectURL = vi.fn()

    vi.stubGlobal('document', { createElement: vi.fn(() => anchor) })
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    await exportToExcel(participants, courses, 'participantes.xlsx')

    expect(document.createElement).toHaveBeenCalledWith('a')
    expect(anchor).toMatchObject({ href: 'blob:excel', download: 'participantes.xlsx' })
    expect(click).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:excel')
  })
})

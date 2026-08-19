/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest'
import { COURSES_STORAGE_KEY } from '../../data/courses.js'
import { coursesLocalAdapter } from './coursesAdapter.js'

const course = {
  id: 'course-1',
  name: 'Curso de prueba',
  active: true,
  accessDays: 45,
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify([course]))
})

describe('coursesLocalAdapter', () => {
  it('aplica el estado activo solicitado en vez de invertirlo a ciegas', async () => {
    const result = await coursesLocalAdapter.toggleActive(course.id, true)

    expect(result).toMatchObject({ id: course.id, active: true })
    expect(JSON.parse(localStorage.getItem(COURSES_STORAGE_KEY))[0].active).toBe(true)
  })

  it('mantiene el contrato de error para cursos inexistentes', async () => {
    const result = await coursesLocalAdapter.toggleActive('missing', false)

    expect(result).toEqual({
      error: {
        message: 'El curso no existe.',
        code: 'COURSE_NOT_FOUND',
      },
    })
  })
})

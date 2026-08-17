// ============================================================
// coursesLocalAdapter.js
// Persistencia local de cursos mediante localStorage.
// ============================================================

import {
  COURSES_STORAGE_KEY,
  DEFAULT_COURSES,
} from '../../data/courses.js'

function loadCourses() {
  try {
    const raw = localStorage.getItem(COURSES_STORAGE_KEY)

    if (!raw) {
      return structuredClone(DEFAULT_COURSES)
    }

    const parsed = JSON.parse(raw)

    return parsed.map(course => ({
      ...course,
      accessDays:
        course.accessDays != null
          ? Number(course.accessDays)
          : 45,
    }))
  } catch {
    return structuredClone(DEFAULT_COURSES)
  }
}

function saveCourses(courses) {
  localStorage.setItem(
    COURSES_STORAGE_KEY,
    JSON.stringify(courses)
  )
}

export const coursesLocalAdapter = {
  async getCourses() {
    return loadCourses()
  },

  async addCourse(form) {
    const courses = loadCourses()

    const newCourse = {
      id: 'c' + Date.now(),
      name: form.name || 'Nuevo curso',
      short:
        form.short ||
        form.name?.slice(0, 20) ||
        'Curso',
      type: form.type || 'curso',
      platform: form.platform || 'TEC Digital',
      start: form.start || '',
      end: form.end || '',
      capacity: Number(form.capacity) || 30,
      price: form.price || '0',
      modalidad: form.modalidad || 'Asincrónico',
      code: form.code || '',
      description: form.description || '',
      active: true,
      accessDays: Number(form.accessDays) || 45,
      certEnabled: form.certEnabled ?? false,
    }

    saveCourses([...courses, newCourse])

    return newCourse
  },

  async updateCourse(id, form) {
    const courses = loadCourses()

    const updated = courses.map(course =>
      course.id === id
        ? {
            ...course,
            ...form,
            capacity:
              Number(form.capacity) ||
              course.capacity,
            accessDays:
              Number(form.accessDays) ||
              course.accessDays ||
              45,
          }
        : course
    )

    saveCourses(updated)

    return updated.find(course => course.id === id)
  },

  async deleteCourse(id) {
    const courses = loadCourses()

    const updated = courses.filter(
      course => course.id !== id
    )

    saveCourses(updated)
  },

  async toggleActive(id) {
    const courses = loadCourses()

    const updated = courses.map(course =>
      course.id === id
        ? {
            ...course,
            active: !course.active,
          }
        : course
    )

    saveCourses(updated)

    return updated.find(course => course.id === id)
  },
}
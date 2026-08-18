// ============================================================
// coursesLocalAdapter.js
// Persistencia local de cursos mediante localStorage.
//
// Mantiene el mismo contrato que el adapter de Supabase.
//
// Contrato:
//   - Éxito con entidad → entidad
//   - Éxito sin entidad → resultado explícito
//   - Error → { error: { message, code } }
// ============================================================

import {
  COURSES_STORAGE_KEY,
  DEFAULT_COURSES,
} from '../../data/courses.js'

// ============================================================
// Helpers
// ============================================================

function createError(message, code) {
  return {
    error: {
      message,
      code,
    },
  }
}

function loadCourses() {
  try {
    const raw =
      localStorage.getItem(COURSES_STORAGE_KEY)

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

  } catch (error) {
    console.error(
      '[coursesLocalAdapter] loadCourses',
      error
    )

    return createError(
      'No se pudieron cargar los cursos.',
      'COURSES_LOAD_ERROR'
    )
  }
}

function saveCourses(courses) {
  try {
    localStorage.setItem(
      COURSES_STORAGE_KEY,
      JSON.stringify(courses)
    )

    return null

  } catch (error) {
    console.error(
      '[coursesLocalAdapter] saveCourses',
      error
    )

    return createError(
      'No se pudieron guardar los cursos.',
      'COURSES_SAVE_ERROR'
    )
  }
}

// ============================================================
// Adapter
// ============================================================

export const coursesLocalAdapter = {

  // ----------------------------------------------------------
  // Obtener cursos
  // ----------------------------------------------------------

  async getCourses() {
    return loadCourses()
  },

  // ----------------------------------------------------------
  // Agregar curso
  // ----------------------------------------------------------

  async addCourse(form) {
    const courses = loadCourses()

    if (courses?.error) {
      return courses
    }

    const newCourse = {
      id: 'c' + Date.now(),
      name:
        form.name ||
        'Nuevo curso',
      short:
        form.short ||
        form.name?.slice(0, 20) ||
        'Curso',
      type:
        form.type ||
        'curso',
      platform:
        form.platform ||
        'TEC Digital',
      start:
        form.start ||
        '',
      end:
        form.end ||
        '',
      capacity:
        Number(form.capacity) ||
        30,
      price:
        form.price ||
        '0',
      modalidad:
        form.modalidad ||
        'Asincrónico',
      code:
        form.code ||
        '',
      description:
        form.description ||
        '',
      active: true,
      accessDays:
        Number(form.accessDays) ||
        45,
      certEnabled:
        form.certEnabled ??
        false,
    }

    const saveResult =
      saveCourses([
        ...courses,
        newCourse,
      ])

    if (saveResult?.error) {
      return saveResult
    }

    return newCourse
  },

  // ----------------------------------------------------------
  // Actualizar curso
  // ----------------------------------------------------------

  async updateCourse(id, form) {
    const courses = loadCourses()

    if (courses?.error) {
      return courses
    }

    const currentCourse =
      courses.find(
        course =>
          course.id === id
      )

    if (!currentCourse) {
      return createError(
        'El curso no existe.',
        'COURSE_NOT_FOUND'
      )
    }

    const updatedCourse = {
      ...currentCourse,
      ...form,
      capacity:
        Number(form.capacity) ||
        currentCourse.capacity,
      accessDays:
        Number(form.accessDays) ||
        currentCourse.accessDays ||
        45,
    }

    const updated =
      courses.map(course =>
        course.id === id
          ? updatedCourse
          : course
      )

    const saveResult =
      saveCourses(updated)

    if (saveResult?.error) {
      return saveResult
    }

    return updatedCourse
  },

  // ----------------------------------------------------------
  // Eliminar curso
  // ----------------------------------------------------------

  async deleteCourse(id) {
    const courses = loadCourses()

    if (courses?.error) {
      return courses
    }

    const exists =
      courses.some(
        course =>
          course.id === id
      )

    if (!exists) {
      return createError(
        'El curso no existe.',
        'COURSE_NOT_FOUND'
      )
    }

    const updated =
      courses.filter(
        course =>
          course.id !== id
      )

    const saveResult =
      saveCourses(updated)

    if (saveResult?.error) {
      return saveResult
    }

    return {
      id,
      deleted: true,
    }
  },

  // ----------------------------------------------------------
  // Activar / desactivar curso
  // ----------------------------------------------------------

  async toggleActive(id) {
    const courses = loadCourses()

    if (courses?.error) {
      return courses
    }

    const currentCourse =
      courses.find(
        course =>
          course.id === id
      )

    if (!currentCourse) {
      return createError(
        'El curso no existe.',
        'COURSE_NOT_FOUND'
      )
    }

    const updatedCourse = {
      ...currentCourse,
      active:
        !currentCourse.active,
    }

    const updated =
      courses.map(course =>
        course.id === id
          ? updatedCourse
          : course
      )

    const saveResult =
      saveCourses(updated)

    if (saveResult?.error) {
      return saveResult
    }

    return updatedCourse
  },

}
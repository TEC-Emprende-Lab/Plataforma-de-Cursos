import { useState, useEffect, useCallback } from 'react'
import { storageMode } from '../lib/supabase.js'
import { coursesLocalAdapter } from '../adapters/local/coursesAdapter.js'
import { coursesSupabaseAdapter } from '../adapters/supabase/coursesAdapter.js'

const coursesAdapter =
  storageMode === 'local'
    ? coursesLocalAdapter
    : coursesSupabaseAdapter

export function useCourses() {

  const [courses, setCourses] = useState([])

  useEffect(() => {
    let cancelled = false

    coursesAdapter
      .getCourses()
      .then(data => {
        if (!cancelled) {
          setCourses(data)
        }
      })
      .catch(error => {
        console.error('[useCourses] getCourses', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const addCourse = useCallback(async (form) => {
    try {
      const newCourse =
        await coursesAdapter.addCourse(form)

      setCourses(prev => [
        ...prev,
        newCourse,
      ])

      return newCourse
    } catch (error) {
      console.error('[useCourses] addCourse', error)
      return { error }
    }
  }, [])

  const updateCourse = useCallback(async (id, form) => {
    try {
      const updatedCourse =
        await coursesAdapter.updateCourse(id, form)

      setCourses(prev =>
        prev.map(course =>
          course.id === id
            ? updatedCourse
            : course
        )
      )

      return updatedCourse
    } catch (error) {
      console.error('[useCourses] updateCourse', error)
      return { error }
    }
  }, [])

  const deleteCourse = useCallback(async (
    id,
    setParticipants
  ) => {
    try {
      await coursesAdapter.deleteCourse(id)

      setCourses(prev =>
        prev.filter(course => course.id !== id)
      )

      if (setParticipants) {
        setParticipants(prev =>
          prev.map(participant => ({
            ...participant,
            courses: (participant.courses || [])
              .filter(courseId => courseId !== id),
          }))
        )
      }
    } catch (error) {
      console.error('[useCourses] deleteCourse', error)
      return { error }
    }
  }, [])

  const toggleActive = useCallback(async (id) => {
    const current = courses.find(
      course => course.id === id
    )

    if (!current) return

    try {
      const updatedCourse =
        await coursesAdapter.toggleActive(
          id,
          !current.active
        )

      setCourses(prev =>
        prev.map(course =>
          course.id === id
            ? updatedCourse
            : course
        )
      )

      return updatedCourse
    } catch (error) {
      console.error(
        '[useCourses] toggleActive',
        error
      )

      return { error }
    }
  }, [courses])

  return {
    courses,
    addCourse,
    updateCourse,
    deleteCourse,
    toggleActive,
  }
}
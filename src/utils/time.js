// ============================================================
//  time.js — JavaScript
//  Funciones puras de cálculo de tiempo y fechas.
//  No dependen de React ni de ningún otro módulo.
//
//  Regla: el día de ingreso cuenta como día 1 de vigencia.
//  `daysElapsed` mide días completos transcurridos desde el
//  ingreso: retorna 0 el mismo día del ingreso y el acceso
//  expira exactamente al cumplirse `days` días naturales.
//  Si la fecha de ingreso es futura, se trata como si fuera hoy.
//  Todas las funciones aceptan un segundo parámetro opcional
//  `days` (días de acceso del curso). Si no se pasa, se usa
//  el valor global ACCESS_DAYS como respaldo.
//
//  "Hoy" se calcula en cada llamada para que una sesión abierta
//  al cruzar la medianoche refleje la fecha real.
// ============================================================

export { ACCESS_DAYS, WARN_DAYS, EXAM_WARN } from '../data/constants.js'
import { ACCESS_DAYS, WARN_DAYS, EXAM_WARN } from '../data/constants.js'

function todayAtMidnight() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function parseLocal(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Días completos transcurridos desde la fecha de ingreso (mín. 0).
 * El mismo día del ingreso retorna 0.
 * Si la fecha es futura, retorna 0.
 * @param {string} fechaStr - Formato ISO 'YYYY-MM-DD'
 */
export function daysElapsed(fechaStr) {
  return Math.max(0, Math.round((todayAtMidnight() - parseLocal(fechaStr)) / 86_400_000))
}

/**
 * Días restantes de acceso (mín. 0).
 * @param {string} fechaStr - Formato ISO 'YYYY-MM-DD'
 * @param {number} [days]   - Días de acceso del curso (por defecto ACCESS_DAYS)
 */
export function daysLeft(fechaStr, days = ACCESS_DAYS) {
  return Math.max(0, days - daysElapsed(fechaStr))
}

/**
 * Porcentaje consumido del período de acceso (0-100).
 * @param {string} fechaStr - Formato ISO 'YYYY-MM-DD'
 * @param {number} [days]   - Días de acceso del curso (por defecto ACCESS_DAYS)
 */
export function accessPct(fechaStr, days = ACCESS_DAYS) {
  return Math.min(100, Math.round(daysElapsed(fechaStr) / days * 100))
}

/**
 * true si el período de acceso ya expiró.
 * @param {string} fechaStr - Formato ISO 'YYYY-MM-DD'
 * @param {number} [days]   - Días de acceso del curso (por defecto ACCESS_DAYS)
 */
export function isExpired(fechaStr, days = ACCESS_DAYS) {
  return daysElapsed(fechaStr) >= days
}

/**
 * true si quedan ≤ WARN_DAYS días (pero aún no expiró).
 * @param {string} fechaStr - Formato ISO 'YYYY-MM-DD'
 * @param {number} [days]   - Días de acceso del curso (por defecto ACCESS_DAYS)
 */
export function isWarning(fechaStr, days = ACCESS_DAYS) {
  const left = daysLeft(fechaStr, days)
  return left > 0 && left <= WARN_DAYS
}

/**
 * true si está dentro de la ventana de recordatorio de prueba.
 * @param {string} fechaStr - Formato ISO 'YYYY-MM-DD'
 * @param {number} [days]   - Días de acceso del curso (por defecto ACCESS_DAYS)
 */
export function needsExamReminder(fechaStr, days = ACCESS_DAYS) {
  const left = daysLeft(fechaStr, days)
  return left > 0 && left <= EXAM_WARN && !isExpired(fechaStr, days)
}

/** Formatea fecha ISO a string legible en español (CR) */
export function fmtDate(str) {
  if (!str) return '—'
  return new Date(str + 'T12:00:00').toLocaleDateString('es-CR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/**
 * Fecha en que expira el acceso de un participante.
 * @param {string} fechaStr - Formato ISO 'YYYY-MM-DD'
 * @param {number} [days]   - Días de acceso del curso (por defecto ACCESS_DAYS)
 */
export function expiryDate(fechaStr, days = ACCESS_DAYS) {
  const d = parseLocal(fechaStr)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Fecha límite para realizar la prueba.
 * @param {string} fechaStr - Formato ISO 'YYYY-MM-DD'
 * @param {number} [days]   - Días de acceso del curso (por defecto ACCESS_DAYS)
 */
export function examDeadlineDate(fechaStr, days = ACCESS_DAYS) {
  const d = parseLocal(fechaStr)
  d.setDate(d.getDate() + days - EXAM_WARN)
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Fecha de hoy en formato ISO */
export function todayISO() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * Resuelve los días de acceso para un participante según sus cursos.
 * Si está en más de un curso, usa el máximo.
 * @param {object} participant - Debe tener .courses = [id, ...]
 * @param {Array}  courses     - Lista de todos los cursos
 * @returns {number}
 */
export function getAccessDays(participant, courses = []) {
  if (!participant?.courses?.length || !courses.length) return ACCESS_DAYS
  const enrolled = courses.filter(c => participant.courses.includes(c.id))
  if (!enrolled.length) return ACCESS_DAYS
  return Math.max(...enrolled.map(c => Number(c.accessDays) || ACCESS_DAYS))
}

// ============================================================
//  validators.js — Validaciones compartidas de formulario.
//
//  Fuente única de verdad para formato y duplicados. La usan la
//  UI y ambos adapters (local y Supabase) para que el
//  comportamiento sea equivalente en cualquier modo de
//  persistencia.
// ============================================================

export const EMAIL_RE  = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
export const CEDULA_RE = /^\d{8,15}$/
export const PHONE_RE  = /^\d{4}-?\d{4}$/

/** Correo con formato válido. */
export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim())
}

/** Teléfono de 8 dígitos (CR), con o sin guión; ignora espacios. */
export function isValidPhone(value) {
  return PHONE_RE.test(String(value || '').replace(/\s/g, ''))
}

/**
 * Cédula opcionalmente segmentada (guiones/espacios/puntos) cuyo
 * total de dígitos esté entre 8 y 15.
 */
export function isValidCedula(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return CEDULA_RE.test(digits)
}

/**
 * Primer participante con el mismo correo (comparación exacta e
 * insensible a mayúsculas), excluyendo excludeId. Null si no hay.
 */
export function findDuplicateByEmail(email, participants = [], excludeId = null) {
  const target = String(email || '').trim().toLowerCase()
  if (!target) return null
  return participants.find(
    p => p.id !== excludeId && String(p.email || '').trim().toLowerCase() === target
  ) || null
}

/** Normaliza nombres de etiqueta para comparación: trim, espacios simples, minúsculas. */
export function normalizeTagName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

/** Primera etiqueta con el mismo nombre normalizado, excluyendo excludeId. */
export function findDuplicateTagName(name, tags = [], excludeId = null) {
  const target = normalizeTagName(name)
  if (!target) return null
  return tags.find(t => t.id !== excludeId && normalizeTagName(t.name) === target) || null
}

/**
 * Validación compartida de alta/edición de etiquetas usada por la
 * vista y por los dos adapters:
 * - devuelve { error } con contrato { message, code }, o
 * - devuelve { name } con el nombre trimeado listo para persistir.
 */
export function validateTag(name, existingTags = [], excludeId = null) {
  const trimmed = String(name || '').trim().replace(/\s+/g, ' ')
  if (!trimmed) {
    return {
      error: {
        message: 'El nombre de la etiqueta es requerido.',
        code: 'TAG_NAME_REQUIRED',
      },
    }
  }
  const dup = findDuplicateTagName(trimmed, existingTags, excludeId)
  if (dup) {
    return {
      error: {
        message: `Ya existe una etiqueta llamada "${dup.name}".`,
        code: 'TAG_DUPLICATE',
      },
    }
  }
  return { name: trimmed }
}

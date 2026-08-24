import { describe, expect, it } from 'vitest'
import {
  isValidEmail,
  isValidPhone,
  isValidCedula,
  findDuplicateByEmail,
  findDuplicateTagName,
  validateTag,
} from './validators.js'

describe('isValidEmail', () => {
  it('acepta correos con formato razonable y rechaza el resto', () => {
    expect(isValidEmail('ana@example.com')).toBe(true)
    expect(isValidEmail('  ana.doe+tec@sub.ejemplo.co.cr  ')).toBe(true)
    expect(isValidEmail('sin-arroba.example.com')).toBe(false)
    expect(isValidEmail('ana@sin-dominio')).toBe(false)
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail(null)).toBe(false)
  })
})

describe('isValidPhone', () => {
  it('acepta 8 dígitos con o sin guión e ignora espacios', () => {
    expect(isValidPhone('8888-8888')).toBe(true)
    expect(isValidPhone('88888888')).toBe(true)
    expect(isValidPhone(' 8888 8888 ')).toBe(true)
    expect(isValidPhone('8888-888')).toBe(false)
    expect(isValidPhone('abc')).toBe(false)
    expect(isValidPhone('')).toBe(false)
  })
})

describe('isValidCedula', () => {
  it('acepta cédulas segmentadas o planas de 8 a 15 dígitos', () => {
    expect(isValidCedula('1-0234-0567')).toBe(true)
    expect(isValidCedula('102340567')).toBe(true)
    expect(isValidCedula('12345678')).toBe(true)          // 8 dígitos
    expect(isValidCedula('8-123-456789')).toBe(true)      // DIMEX largo
    expect(isValidCedula('1-234-56')).toBe(false)         // 7 dígitos
    expect(isValidCedula('12a34')).toBe(false)
    expect(isValidCedula('')).toBe(false)
    expect(isValidCedula(null)).toBe(false)
  })
})

describe('findDuplicateByEmail', () => {
  const participants = [
    { id: 'a', email: 'Ana@Example.com' },
    { id: 'b', email: 'carlos@example.com' },
    { id: 'c', email: '' },
  ]

  it('encuentra duplicados ignorando mayúsculas y espacios', () => {
    expect(findDuplicateByEmail(' ana@example.com ', participants)?.id).toBe('a')
  })

  it('excluye al propio participante en ediciones', () => {
    expect(findDuplicateByEmail('ANA@example.com', participants, 'a')).toBeNull()
  })

  it('retorna null con correo vacío o sin duplicado', () => {
    expect(findDuplicateByEmail('', participants)).toBeNull()
    expect(findDuplicateByEmail('otro@example.com', participants)).toBeNull()
  })
})

describe('validateTag / findDuplicateTagName', () => {
  const tags = [
    { id: 't1', name: 'Becado' },
    { id: 't2', name: 'VIP' },
  ]

  it('rechaza nombres vacíos o solo espacios', () => {
    expect(validateTag('   ', tags).error.code).toBe('TAG_NAME_REQUIRED')
    expect(validateTag('', tags).error.code).toBe('TAG_NAME_REQUIRED')
  })

  it('rechaza duplicados insensibles a mayúsculas y espacios extra', () => {
    expect(validateTag('becado', tags).error.code).toBe('TAG_DUPLICATE')
    expect(validateTag('  VIP  ', tags).error.code).toBe('TAG_DUPLICATE')
    expect(validateTag('Becado', tags, 't1').error).toBeUndefined()
  })

  it('normaliza espacios internos y devuelve el nombre listo para guardar', () => {
    const result = validateTag('  Empresa   aliada ', tags)
    expect(result.name).toBe('Empresa aliada')
    expect(result.error).toBeUndefined()
  })

  it('findDuplicateTagName normaliza igual que validateTag', () => {
    expect(findDuplicateTagName('vip', tags)?.id).toBe('t2')
    expect(findDuplicateTagName('v i p', tags)).toBeNull()
  })
})

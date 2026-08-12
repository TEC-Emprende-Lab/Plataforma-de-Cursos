import { describe, expect, it } from 'vitest'
import { cedulasMatch, formatCedula, normalizeCedula } from './cedula.js'

describe('normalizeCedula', () => {
  it.each([
    ['1-234-567', '102340567'],
    ['1 0234 0567', '102340567'],
    ['1.234.567', '102340567'],
    ['102340567', '102340567'],
    ['1234567', '001234567'],
    [' 155812345678 ', '155812345678'],
  ])('normaliza %j como %s', (raw, expected) => {
    expect(normalizeCedula(raw)).toBe(expected)
  })

  it.each([null, undefined, '', '   ', 'sin-digitos'])('rechaza %j como llave vacía', raw => {
    expect(normalizeCedula(raw)).toBe('')
  })
})

describe('cedulasMatch', () => {
  it('compara usando la forma canónica', () => {
    expect(cedulasMatch('1-234-567', '102340567')).toBe(true)
  })

  it('no considera iguales dos entradas inválidas', () => {
    expect(cedulasMatch('', null)).toBe(false)
  })
})

describe('formatCedula', () => {
  it('formatea cédulas físicas y conserva identificadores más largos', () => {
    expect(formatCedula('102340567')).toBe('1-0234-0567')
    expect(formatCedula('155812345678')).toBe('155812345678')
  })
})

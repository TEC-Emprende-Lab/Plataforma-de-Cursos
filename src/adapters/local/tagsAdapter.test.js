/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest'
import { TAGS_STORAGE_KEY } from '../../data/tags.js'
import { tagsLocalAdapter } from './tagsAdapter.js'

const seedTags = [
  { id: 't1', name: 'Becado', color: 'orange' },
  { id: 't2', name: 'VIP', color: 'black' },
]

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(seedTags))
})

describe('tagsLocalAdapter.add', () => {
  it('crea la etiqueta con el nombre trimeado', async () => {
    const result = await tagsLocalAdapter.add('  Empresa aliada  ', 'orange')

    expect(result).toMatchObject({ name: 'Empresa aliada', color: 'orange' })
    const stored = JSON.parse(localStorage.getItem(TAGS_STORAGE_KEY))
    expect(stored).toHaveLength(3)
  })

  it('rechaza nombres vacíos sin modificar localStorage', async () => {
    const before = localStorage.getItem(TAGS_STORAGE_KEY)

    const result = await tagsLocalAdapter.add('   ', 'orange')

    expect(result).toEqual({
      error: { message: 'El nombre de la etiqueta es requerido.', code: 'TAG_NAME_REQUIRED' },
    })
    expect(localStorage.getItem(TAGS_STORAGE_KEY)).toBe(before)
  })

  it('rechaza duplicados insensibles a mayúsculas', async () => {
    const result = await tagsLocalAdapter.add('becado', 'green')

    expect(result.error.code).toBe('TAG_DUPLICATE')
  })
})

describe('tagsLocalAdapter.update', () => {
  it('actualiza con trim y permite conservar el nombre propio', async () => {
    const result = await tagsLocalAdapter.update('t1', '  Becado ', 'green')

    expect(result).toMatchObject({ id: 't1', name: 'Becado', color: 'green' })
  })

  it('rechaza renombrar a un nombre que ya usa otra etiqueta', async () => {
    const result = await tagsLocalAdapter.update('t1', 'vip', 'green')

    expect(result.error.code).toBe('TAG_DUPLICATE')
    const stored = JSON.parse(localStorage.getItem(TAGS_STORAGE_KEY))
    expect(stored.find(t => t.id === 't1').name).toBe('Becado')
  })

  it('rechaza renombrar a vacío', async () => {
    const result = await tagsLocalAdapter.update('t1', '', 'green')

    expect(result.error.code).toBe('TAG_NAME_REQUIRED')
  })

  it('mantiene TAG_NOT_FOUND para ids inexistentes', async () => {
    const result = await tagsLocalAdapter.update('no-existe', 'X', 'green')

    expect(result.error.code).toBe('TAG_NOT_FOUND')
  })
})

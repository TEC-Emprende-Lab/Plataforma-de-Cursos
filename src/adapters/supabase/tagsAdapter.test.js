import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
}))

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: mocks.from,
  },
}))

import { tagsSupabaseAdapter } from './tagsAdapter.js'

const seedTags = [
  { id: 't1', name: 'Becado', color: 'orange' },
  { id: 't2', name: 'VIP', color: 'black' },
]

// La primera llamada a select corresponde a fetchTags (validación de
// duplicados); las siguientes pertenecen al resultado del insert/update.
function chainWriteResult(resolvedValue) {
  let call = 0
  mocks.select.mockImplementation(() =>
    call++ === 0
      ? { order: mocks.order }
      : { single: mocks.single }
  )
  mocks.single.mockResolvedValue(resolvedValue)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.from.mockReturnValue({
    select: mocks.select,
    insert: mocks.insert,
    update: mocks.update,
  })
  mocks.select.mockImplementation(() => ({ order: mocks.order }))
  mocks.order.mockResolvedValue({ data: seedTags, error: null })
})

describe('tagsSupabaseAdapter.add', () => {
  it('inserta con el nombre trimeado tras validar duplicados', async () => {
    mocks.insert.mockReturnValue({ select: mocks.select })
    chainWriteResult({
      data: { id: 't3', name: 'Empresa aliada', color: 'orange' },
      error: null,
    })

    const result = await tagsSupabaseAdapter.add('  Empresa aliada  ', 'orange')

    expect(mocks.from).toHaveBeenCalledWith('tags')
    expect(mocks.insert).toHaveBeenCalledWith({ name: 'Empresa aliada', color: 'orange' })
    expect(result).toMatchObject({ id: 't3' })
  })

  it('rechaza duplicados sin llegar a insertar', async () => {
    const result = await tagsSupabaseAdapter.add('becado', 'green')

    expect(result.error.code).toBe('TAG_DUPLICATE')
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('rechaza nombres vacíos sin llegar a insertar', async () => {
    const result = await tagsSupabaseAdapter.add('   ', 'green')

    expect(result.error.code).toBe('TAG_NAME_REQUIRED')
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('propaga el error de carga de la lista de validación', async () => {
    // El contrato del adapter devuelve el código propio de Supabase
    // cuando existe (error.code ?? fallback), igual que en participants.
    mocks.order.mockResolvedValue({ data: null, error: { message: 'fallo red', code: 'PGRST' } })

    const result = await tagsSupabaseAdapter.add('Nueva', 'green')

    expect(result.error.message).toBe('fallo red')
    expect(result.error.code).toBe('PGRST')
    expect(mocks.insert).not.toHaveBeenCalled()
  })
})

describe('tagsSupabaseAdapter.update', () => {
  it('valida duplicados excluyendo la etiqueta editada y envía el nombre normalizado', async () => {
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ select: mocks.select })
    chainWriteResult({
      data: { id: 't1', name: 'Becado', color: 'green' },
      error: null,
    })

    const result = await tagsSupabaseAdapter.update('t1', '  Becado ', 'green')

    expect(mocks.update).toHaveBeenCalledWith({ name: 'Becado', color: 'green' })
    expect(mocks.eq).toHaveBeenCalledWith('id', 't1')
    expect(result).toMatchObject({ id: 't1' })
  })

  it('rechaza renombrar a un nombre existente en otra etiqueta', async () => {
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ select: mocks.select })

    const result = await tagsSupabaseAdapter.update('t1', 'vip', 'green')

    expect(result.error.code).toBe('TAG_DUPLICATE')
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

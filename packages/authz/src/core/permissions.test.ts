import { describe, expect, it } from 'vitest'
import {
  filterByPermission,
  getMissingPermissions,
  hasPermissions,
  mergePermissions,
  normalizePermissions,
} from './permissions'

describe('permissions', () => {
  it('normalizes duplicate actions without mutating input', () => {
    const input = {
      order: ['read', 'read', 'delete'],
    } as const

    expect(normalizePermissions(input)).toEqual({
      order: ['read', 'delete'],
    })
    expect(input.order).toEqual(['read', 'read', 'delete'])
  })

  it('merges permissions across roles', () => {
    expect(
      mergePermissions(
        { order: ['read'], invoice: ['read'] },
        { order: ['delete'], invoice: ['read'] }
      )
    ).toEqual({
      order: ['read', 'delete'],
      invoice: ['read'],
    })
  })

  it('supports resource and global wildcards', () => {
    expect(hasPermissions({ order: ['*'] }, { order: ['delete'] })).toBe(true)
    expect(hasPermissions({ '*': ['*'] }, { settings: ['manage'] })).toBe(true)
    expect(hasPermissions({ order: ['read'] }, { order: ['delete'] })).toBe(false)
  })

  it('allows empty requirements', () => {
    expect(hasPermissions({}, undefined)).toBe(true)
    expect(hasPermissions({}, {})).toBe(true)
  })

  it('requires some access when a resource is listed without actions', () => {
    expect(hasPermissions({}, { order: [] })).toBe(false)
    expect(hasPermissions({ order: [] }, { order: [] })).toBe(false)
    expect(hasPermissions({ order: ['read'] }, { order: [] })).toBe(true)
    expect(hasPermissions({ order: ['*'] }, { order: [] })).toBe(true)
    expect(hasPermissions({ '*': ['*'] }, { order: [] })).toBe(true)
  })

  it('reports which permissions are missing', () => {
    expect(getMissingPermissions({ order: ['read'] }, { order: ['read', 'delete'] })).toEqual({
      order: ['delete'],
    })
    expect(getMissingPermissions({ order: ['read'] }, { order: ['read'] })).toEqual({})
    expect(getMissingPermissions({ '*': ['*'] }, { settings: ['manage'] })).toEqual({})
    expect(getMissingPermissions({ order: ['*'] }, { order: ['delete'] })).toEqual({})
    expect(getMissingPermissions({}, { invoice: [] })).toEqual({ invoice: [] })
    expect(getMissingPermissions({ invoice: ['read'] }, { invoice: [] })).toEqual({})
    // Agrees with hasPermissions: missing iff not allowed.
    expect(
      Object.keys(getMissingPermissions({ order: ['read'] }, { order: ['delete'] })).length === 0
    ).toBe(hasPermissions({ order: ['read'] }, { order: ['delete'] }))
  })

  it('filters a list by a permission selector', () => {
    const items: { id: string; need?: Record<string, readonly string[]> }[] = [
      { id: 'a', need: { order: ['read'] } },
      { id: 'b', need: { settings: ['manage'] } },
      { id: 'c' },
    ]

    const allowed = filterByPermission({ order: ['read'] }, items, (item) => item.need)

    expect(allowed.map((item) => item.id)).toEqual(['a', 'c'])
  })
})

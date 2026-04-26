import { describe, expect, it } from 'vitest'
import { hasPermissions, mergePermissions, normalizePermissions } from './permissions'

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
})

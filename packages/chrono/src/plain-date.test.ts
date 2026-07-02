import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  addYears,
  clampDate,
  compare,
  diffMonths,
  diffYears,
  eachMonth,
  endOfWeek,
  endOfYear,
  formatPlainRange,
  isBetween,
  isSameMonth,
  isSameYear,
  startOfYear,
  toUtcRange,
  dayOfWeek,
  diffDays,
  eachDay,
  endOfMonth,
  formatPlain,
  isPlainDate,
  isSameOrAfter,
  maxDate,
  minDate,
  parsePlainDate,
  plainDate,
  startOfMonth,
  startOfWeek,
  toParts,
  toUtcMidnight,
} from './plain-date'

const pd = (s: string) => parsePlainDate(s)!

describe('parsePlainDate', () => {
  it('accepts real calendar days', () => {
    expect(parsePlainDate('2026-07-01')).toBe('2026-07-01')
    expect(parsePlainDate('2024-02-29')).toBe('2024-02-29')
  })

  it('reads Date and epoch millis by UTC components', () => {
    expect(parsePlainDate(new Date('2026-07-01T00:00:00Z'))).toBe('2026-07-01')
    expect(parsePlainDate(new Date('2026-07-01T23:59:59Z'))).toBe('2026-07-01')
    expect(parsePlainDate(Date.UTC(2026, 6, 1))).toBe('2026-07-01')
  })

  it('returns null instead of throwing', () => {
    expect(parsePlainDate('2026-02-30')).toBeNull()
    expect(parsePlainDate('2026-7-1')).toBeNull()
    expect(parsePlainDate('2026-07-01T00:00:00Z')).toBeNull()
    expect(parsePlainDate('garbage')).toBeNull()
    expect(parsePlainDate(new Date('garbage'))).toBeNull()
    expect(parsePlainDate(Number.NaN)).toBeNull()
    expect(parsePlainDate(Number.POSITIVE_INFINITY)).toBeNull()
    expect(parsePlainDate(null)).toBeNull()
    expect(parsePlainDate(undefined)).toBeNull()
    expect(parsePlainDate({})).toBeNull()
    expect(parsePlainDate(new Date(-8.64e15))).toBeNull()
  })
})

describe('plainDate / toParts', () => {
  it('builds and destructures', () => {
    expect(plainDate(2026, 7, 1)).toBe('2026-07-01')
    expect(toParts(pd('2026-07-01'))).toEqual({ year: 2026, month: 7, day: 1 })
  })

  it('returns null on invalid components', () => {
    expect(plainDate(2026, 2, 30)).toBeNull()
    expect(plainDate(2026, 0, 1)).toBeNull()
    expect(plainDate(2026, 13, 1)).toBeNull()
    expect(plainDate(2026, 1.5, 1)).toBeNull()
    expect(plainDate(Number.NaN, 1, 1)).toBeNull()
    expect(plainDate(10000, 1, 1)).toBeNull()
    expect(plainDate(0, 1, 1)).toBeNull()
  })
})

describe('isPlainDate', () => {
  it('validates shape and real days', () => {
    expect(isPlainDate('2026-07-01')).toBe(true)
    expect(isPlainDate('2026-02-30')).toBe(false)
    expect(isPlainDate(20260701)).toBe(false)
  })
})

describe('DATE column boundary', () => {
  it('round-trips through UTC midnight', () => {
    const d = pd('2026-07-01')
    expect(toUtcMidnight(d).toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(parsePlainDate(toUtcMidnight(d))).toBe(d)
  })

  it('years 1-99 are not shifted to 1900-1999 (Date.UTC quirk)', () => {
    const d = pd('0050-01-10')
    expect(toUtcMidnight(d).toISOString()).toBe('0050-01-10T00:00:00.000Z')
    expect(parsePlainDate(toUtcMidnight(d))).toBe(d)
    expect(addDays(d, 1)).toBe('0050-01-11')
    expect(addMonths(pd('0099-12-15'), 1)).toBe('0100-01-15')
    expect(diffDays(pd('0050-01-11'), d)).toBe(1)
  })
})

describe('comparison', () => {
  const a = pd('2026-06-30')
  const b = pd('2026-07-01')

  it('orders lexicographically', () => {
    expect(compare(a, b)).toBe(-1)
    expect(compare(b, a)).toBe(1)
    expect(compare(a, a)).toBe(0)
    expect(a < b).toBe(true)
    expect(isSameOrAfter(b, a)).toBe(true)
  })

  it('min/max', () => {
    expect(minDate(b, a)).toBe(a)
    expect(maxDate(a, b, a)).toBe(b)
  })

  it('isSameMonth / isSameYear', () => {
    expect(isSameMonth(pd('2026-07-01'), pd('2026-07-31'))).toBe(true)
    expect(isSameMonth(pd('2026-07-01'), pd('2026-06-30'))).toBe(false)
    expect(isSameYear(pd('2026-01-01'), pd('2026-12-31'))).toBe(true)
    expect(isSameYear(pd('2026-12-31'), pd('2027-01-01'))).toBe(false)
  })
})

describe('arithmetic', () => {
  it('addDays crosses month and year edges', () => {
    expect(addDays(pd('2026-12-31'), 1)).toBe('2027-01-01')
    expect(addDays(pd('2026-03-01'), -1)).toBe('2026-02-28')
    expect(addDays(pd('2024-03-01'), -1)).toBe('2024-02-29')
  })

  it('addDays never fails: hostile n returns pd unchanged', () => {
    const d = pd('2026-07-01')
    expect(addDays(d, Number.NaN)).toBe(d)
    expect(addDays(d, Number.POSITIVE_INFINITY)).toBe(d)
    expect(addDays(d, 1e12)).toBe(d)
    expect(addDays(d, -1e12)).toBe(d)
    expect(addDays(d, 1.9)).toBe('2026-07-02')
  })

  it('addMonths clamps to end of month', () => {
    expect(addMonths(pd('2026-01-31'), 1)).toBe('2026-02-28')
    expect(addMonths(pd('2024-01-31'), 1)).toBe('2024-02-29')
    expect(addMonths(pd('2026-07-15'), -19)).toBe('2024-12-15')
  })

  it('addMonths never fails: hostile n returns pd unchanged', () => {
    const d = pd('2026-07-01')
    expect(addMonths(d, Number.NaN)).toBe(d)
    expect(addMonths(d, 1e9)).toBe(d)
    expect(addMonths(d, -1e9)).toBe(d)
  })

  it('diffDays', () => {
    expect(diffDays(pd('2026-07-01'), pd('2026-06-30'))).toBe(1)
    expect(diffDays(pd('2026-01-01'), pd('2027-01-01'))).toBe(-365)
  })

  it('month and week boundaries', () => {
    expect(startOfMonth(pd('2026-07-15'))).toBe('2026-07-01')
    expect(endOfMonth(pd('2026-02-10'))).toBe('2026-02-28')
    expect(startOfWeek(pd('2026-07-01'))).toBe('2026-06-29')
    expect(startOfWeek(pd('2026-07-01'), 0)).toBe('2026-06-28')
    expect(dayOfWeek(pd('2026-07-01'))).toBe(3)
    expect(dayOfWeek(pd('2026-07-05'))).toBe(7)
  })

  it('eachDay is inclusive and empty when from > to', () => {
    expect(eachDay(pd('2026-06-29'), pd('2026-07-01'))).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
    ])
    expect(eachDay(pd('2026-07-01'), pd('2026-06-29'))).toEqual([])
  })
})

describe('extended arithmetic and ranges', () => {
  it('addYears clamps leap day', () => {
    expect(addYears(pd('2024-02-29'), 1)).toBe('2025-02-28')
    expect(addYears(pd('2024-02-29'), 4)).toBe('2028-02-29')
    expect(addYears(pd('2026-07-01'), Number.NaN)).toBe('2026-07-01')
  })

  it('diffMonths truncates toward zero, consistent with addMonths clamping', () => {
    expect(diffMonths(pd('2026-07-15'), pd('2026-01-15'))).toBe(6)
    expect(diffMonths(pd('2026-07-14'), pd('2026-01-15'))).toBe(5)
    expect(diffMonths(pd('2026-01-15'), pd('2026-07-15'))).toBe(-6)
    expect(diffMonths(pd('2026-02-28'), pd('2026-01-31'))).toBe(1)
    expect(diffYears(pd('2028-06-30'), pd('2026-07-01'))).toBe(1)
    expect(diffYears(pd('2028-07-01'), pd('2026-07-01'))).toBe(2)
  })

  it('year and week boundaries', () => {
    expect(startOfYear(pd('2026-07-15'))).toBe('2026-01-01')
    expect(endOfYear(pd('2026-07-15'))).toBe('2026-12-31')
    expect(endOfWeek(pd('2026-07-01'))).toBe('2026-07-05')
    expect(endOfWeek(pd('2026-07-01'), 0)).toBe('2026-07-04')
  })

  it('clampDate and isBetween', () => {
    expect(clampDate(pd('2026-07-15'), pd('2026-07-01'), pd('2026-07-31'))).toBe('2026-07-15')
    expect(clampDate(pd('2026-06-01'), pd('2026-07-01'), pd('2026-07-31'))).toBe('2026-07-01')
    expect(clampDate(pd('2026-08-09'), pd('2026-07-01'), pd('2026-07-31'))).toBe('2026-07-31')
    expect(isBetween(pd('2026-07-01'), pd('2026-07-01'), pd('2026-07-31'))).toBe(true)
    expect(isBetween(pd('2026-08-01'), pd('2026-07-01'), pd('2026-07-31'))).toBe(false)
  })

  it('eachMonth covers touched months, empty when from > to', () => {
    expect(eachMonth(pd('2026-05-20'), pd('2026-07-02'))).toEqual([
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
    ])
    expect(eachMonth(pd('2026-07-02'), pd('2026-05-20'))).toEqual([])
  })

  it('toUtcRange gives inclusive UTC-midnight bounds for DATE columns', () => {
    const r = toUtcRange(pd('2026-07-01'), pd('2026-07-31'))
    expect(r.gte.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(r.lte.toISOString()).toBe('2026-07-31T00:00:00.000Z')
  })
})

describe('formatPlain', () => {
  it('formats at UTC so the day never shifts', () => {
    const d = pd('2026-07-01')
    expect(formatPlain(d, 'es')).toContain('julio')
    expect(formatPlain(d, 'en-US', { dateStyle: 'short' })).toContain('7/1')
  })

  it('never throws: bad locale or options fall back to ISO', () => {
    const d = pd('2026-07-01')
    expect(formatPlain(d, '!!not-a-locale!!')).toBe('2026-07-01')
    expect(formatPlain(d, 'en-US', { dateStyle: 'full', year: 'numeric' })).toBe('2026-07-01')
  })
})

describe('formatPlainRange', () => {
  it('formats a range, collapsing shared parts', () => {
    const out = formatPlainRange(pd('2026-07-01'), pd('2026-07-15'), 'en-US')
    expect(out).toContain('July')
    expect(out).toContain('15')
    expect(out).toContain('2026')
  })

  it('equal days collapse to a single date', () => {
    const out = formatPlainRange(pd('2026-07-01'), pd('2026-07-01'), 'en-US')
    expect(out).toBe('July 1, 2026')
  })

  it('never throws: reversed order swaps, bad locale falls back to ISO', () => {
    const swapped = formatPlainRange(pd('2026-07-15'), pd('2026-07-01'), 'en-US')
    expect(swapped).toContain('July')
    expect(formatPlainRange(pd('2026-07-01'), pd('2026-07-15'), '!!bad!!')).toBe(
      '2026-07-01 – 2026-07-15'
    )
  })
})

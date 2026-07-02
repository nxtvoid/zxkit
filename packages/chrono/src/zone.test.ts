import { describe, expect, it } from 'vitest'
import { formatElapsed, isValidTimeZone, parseInstant, zone } from './zone'
import { parsePlainDate } from './plain-date'

const pd = (s: string) => parsePlainDate(s)!

const HAVANA = 'America/Havana'
const hav = zone(HAVANA, { locale: 'es' })
const utc = zone('UTC')

describe('zone', () => {
  it('exposes its configuration', () => {
    expect(hav.timeZone).toBe(HAVANA)
    expect(hav.locale).toBe('es')
    expect(hav.weekStartsOn).toBe(1)
  })

  it('never throws: invalid zone resolves to UTC', () => {
    expect(isValidTimeZone(HAVANA)).toBe(true)
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false)
    const bad = zone('Mars/Olympus_Mons')
    expect(bad.timeZone).toBe('UTC')
    expect(bad.today()).toBe(utc.today())
  })
})

describe('dayOf / today', () => {
  it('resolves the day in the zone', () => {
    const instant = '2026-07-01T02:00:00Z'
    expect(hav.dayOf(instant)).toBe('2026-06-30')
    expect(zone('Asia/Tokyo').dayOf(instant)).toBe('2026-07-01')
    expect(utc.dayOf(instant)).toBe('2026-07-01')
  })

  it('returns null on invalid input', () => {
    expect(hav.dayOf('garbage')).toBeNull()
    expect(hav.dayOf(Number.NaN)).toBeNull()
    expect(hav.dayOf(new Date('nope'))).toBeNull()
  })

  it('today matches dayOf(now) and day predicates agree', () => {
    const t = hav.today()
    expect(hav.dayOf(Date.now())).toBe(t)
    expect(hav.isToday(t)).toBe(true)
    expect(hav.isPast(pd('2000-01-01'))).toBe(true)
    expect(hav.isFuture(pd('2999-01-01'))).toBe(true)
  })
})

describe('startOfDay / startOfWeek', () => {
  it('finds local midnight as an instant', () => {
    expect(hav.startOfDay(pd('2026-06-30')).toISOString()).toBe('2026-06-30T04:00:00.000Z')
    expect(utc.startOfDay(pd('2026-06-30')).toISOString()).toBe('2026-06-30T00:00:00.000Z')
  })

  it('startOfWeek honors weekStartsOn', () => {
    expect(utc.startOfWeek(pd('2026-07-01')).toISOString()).toBe('2026-06-29T00:00:00.000Z')
    const sunday = zone('UTC', { weekStartsOn: 0 })
    expect(sunday.startOfWeek(pd('2026-07-01')).toISOString()).toBe('2026-06-28T00:00:00.000Z')
  })

  it('defaults to today', () => {
    expect(hav.dayOf(hav.startOfDay())).toBe(hav.today())
    expect(hav.startOfWeek().getTime()).toBeLessThanOrEqual(hav.startOfDay().getTime())
  })
})

describe('formatting', () => {
  const instant = '2026-07-01T15:05:00Z'

  it('format uses the preset locale', () => {
    expect(hav.format(pd('2026-07-01'))).toContain('julio')
  })

  it('formatTime is 24h in the zone', () => {
    expect(utc.formatTime(instant)).toBe('15:05')
    expect(hav.formatTime(instant)).toBe('11:05')
  })

  it('formatInstant renders date and time', () => {
    const out = zone('UTC', { locale: 'en-US' }).formatInstant(instant)
    expect(out).toContain('2026')
    expect(out).toContain('Jul')
  })

  it('formatRange uses the preset locale', () => {
    const out = hav.formatRange(pd('2026-07-01'), pd('2026-07-15'))
    expect(out).toContain('julio')
    expect(out).toContain('15')
  })

  it('never throws: invalid instants → null, bad options → ISO fallback', () => {
    expect(hav.formatTime('garbage')).toBeNull()
    expect(hav.formatInstant(Number.NaN)).toBeNull()
    expect(zone('UTC', { locale: '!!bad!!' }).formatTime(instant)).toBe('15:05')
    expect(utc.formatInstant(instant, { dateStyle: 'full', year: 'numeric' })).toBe(
      '2026-07-01T15:05:00.000Z'
    )
  })
})

describe('toInstant', () => {
  it('resolves local wall-clock times to instants', () => {
    expect(hav.toInstant(pd('2026-06-30'), '14:30')!.toISOString()).toBe('2026-06-30T18:30:00.000Z')
    expect(hav.toInstant(pd('2026-01-15'), '14:30')!.toISOString()).toBe('2026-01-15T19:30:00.000Z')
    expect(hav.toInstant(pd('2026-06-30'), '09:05:30')!.toISOString()).toBe(
      '2026-06-30T13:05:30.000Z'
    )
    expect(hav.toInstant(pd('2026-06-30'))!.toISOString()).toBe('2026-06-30T04:00:00.000Z')
  })

  it('returns null on invalid times', () => {
    expect(hav.toInstant(pd('2026-06-30'), '25:00')).toBeNull()
    expect(hav.toInstant(pd('2026-06-30'), '12:60')).toBeNull()
    expect(hav.toInstant(pd('2026-06-30'), 'garbage')).toBeNull()
  })

  it('resolves inside DST gaps to an existing instant of the same day', () => {
    const t = hav.toInstant(pd('2026-03-08'), '00:30')!
    expect(hav.dayOf(t)).toBe('2026-03-08')
  })
})

describe('ranges', () => {
  it('dayRange covers one local day, half-open', () => {
    const r = hav.dayRange(pd('2026-06-30'))
    expect(r.gte.toISOString()).toBe('2026-06-30T04:00:00.000Z')
    expect(r.lt.toISOString()).toBe('2026-07-01T04:00:00.000Z')
  })

  it('weekRange starts on the configured week day', () => {
    const r = hav.weekRange(pd('2026-07-01'))
    expect(r.gte.toISOString()).toBe('2026-06-29T04:00:00.000Z')
    expect(r.lt.toISOString()).toBe('2026-07-06T04:00:00.000Z')
  })

  it('monthRange crossing a DST change has uneven UTC edges', () => {
    const r = hav.monthRange(pd('2026-03-15'))
    expect(r.gte.toISOString()).toBe('2026-03-01T05:00:00.000Z')
    expect(r.lt.toISOString()).toBe('2026-04-01T04:00:00.000Z')
  })

  it('yearRange covers the local year', () => {
    const r = hav.yearRange(pd('2026-07-01'))
    expect(r.gte.toISOString()).toBe('2026-01-01T05:00:00.000Z')
    expect(r.lt.toISOString()).toBe('2027-01-01T05:00:00.000Z')
  })

  it('rangeBetween is inclusive of both days and normalizes reversed order', () => {
    const r = hav.rangeBetween(pd('2026-06-29'), pd('2026-06-30'))
    expect(r.gte.toISOString()).toBe('2026-06-29T04:00:00.000Z')
    expect(r.lt.toISOString()).toBe('2026-07-01T04:00:00.000Z')
    const swapped = hav.rangeBetween(pd('2026-06-30'), pd('2026-06-29'))
    expect(swapped.gte.getTime()).toBe(r.gte.getTime())
    expect(swapped.lt.getTime()).toBe(r.lt.getTime())
  })

  it('ranges at the year-9999 saturation edge stay non-empty', () => {
    for (const r of [
      utc.dayRange(pd('9999-12-31')),
      utc.monthRange(pd('9999-12-01')),
      utc.yearRange(pd('9999-06-01')),
      utc.rangeBetween(pd('9999-12-30'), pd('9999-12-31')),
    ]) {
      expect(r.gte.getTime()).toBeLessThan(r.lt.getTime())
    }
  })
})

describe('formatRelative', () => {
  const now = '2026-07-01T12:00:00Z'

  it('localizes with numeric auto', () => {
    expect(hav.formatRelative('2026-07-01T11:55:00Z', { now })).toBe('hace 5 minutos')
    expect(hav.formatRelative('2026-07-01T14:00:00Z', { now })).toBe('dentro de 2 horas')
    expect(hav.formatRelative('2026-07-02T12:00:00Z', { now })).toBe('mañana')
    expect(hav.formatRelative('2026-07-01T12:00:30Z', { now })).toBe('dentro de 30 segundos')
  })

  it('returns null on invalid input', () => {
    expect(hav.formatRelative('garbage', { now })).toBeNull()
    expect(hav.formatRelative(now, { now: 'garbage' })).toBeNull()
  })
})

describe('DST transitions at midnight (America/Havana)', () => {
  it('standard vs daylight offsets', () => {
    expect(hav.startOfDay(pd('2026-01-15')).toISOString()).toBe('2026-01-15T05:00:00.000Z')
    expect(hav.startOfDay(pd('2026-06-30')).toISOString()).toBe('2026-06-30T04:00:00.000Z')
  })

  it('late-evening instants stay on the local day, both seasons', () => {
    expect(hav.dayOf('2026-07-01T03:00:00Z')).toBe('2026-06-30')
    expect(hav.dayOf('2026-01-16T04:30:00Z')).toBe('2026-01-15')
    expect(hav.dayOf('2026-07-01T03:59:59Z')).toBe('2026-06-30')
    expect(hav.dayOf('2026-07-01T04:00:00Z')).toBe('2026-07-01')
  })

  it('spring forward: midnight is skipped, day starts 01:00 local', () => {
    const start = hav.startOfDay(pd('2026-03-08'))
    expect(start.toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(hav.dayOf(start)).toBe('2026-03-08')
    expect(hav.dayOf(start.getTime() - 1)).toBe('2026-03-07')
  })

  it('fall back: 00:00-01:00 repeats, startOfDay is the first occurrence', () => {
    const start = hav.startOfDay(pd('2026-11-01'))
    expect(start.toISOString()).toBe('2026-11-01T04:00:00.000Z')
    expect(hav.dayOf(start)).toBe('2026-11-01')
    expect(hav.dayOf('2026-11-01T04:30:00Z')).toBe('2026-11-01')
    expect(hav.dayOf('2026-11-01T05:30:00Z')).toBe('2026-11-01')
  })

  it('DATE column round-trip never shifts the day', () => {
    const stored = new Date('2026-07-01T00:00:00Z')
    expect(parsePlainDate(stored)).toBe('2026-07-01')
    expect(hav.dayOf(stored)).toBe('2026-06-30')
  })

  it('weeks start on Monday', () => {
    expect(hav.startOfWeek(pd('2026-07-01')).toISOString()).toBe('2026-06-29T04:00:00.000Z')
  })
})

describe('parseInstant', () => {
  it('accepts Date, epoch millis, and datetime strings', () => {
    expect(parseInstant('2026-07-01T10:05:00Z')!.toISOString()).toBe('2026-07-01T10:05:00.000Z')
    expect(parseInstant(0)!.toISOString()).toBe('1970-01-01T00:00:00.000Z')
    expect(parseInstant(new Date(1234))!.getTime()).toBe(1234)
  })

  it('returns null instead of throwing or coercing', () => {
    expect(parseInstant('garbage')).toBeNull()
    expect(parseInstant(new Date('nope'))).toBeNull()
    expect(parseInstant(Number.NaN)).toBeNull()
    expect(parseInstant(null)).toBeNull()
    expect(parseInstant(undefined)).toBeNull()
    expect(parseInstant({})).toBeNull()
    expect(parseInstant(true)).toBeNull()
  })
})

describe('formatElapsed', () => {
  it('formats compact elapsed time', () => {
    expect(formatElapsed('2026-07-01T10:00:00Z', '2026-07-01T10:05:00Z')).toBe('5m')
    expect(formatElapsed('2026-07-01T10:00:00Z', '2026-07-01T11:30:00Z')).toBe('1h 30m')
    expect(formatElapsed('2026-07-01T10:00:00Z', '2026-07-01T09:00:00Z')).toBe('0m')
  })

  it('returns null on invalid input', () => {
    expect(formatElapsed('garbage')).toBeNull()
    expect(formatElapsed('2026-07-01T10:00:00Z', 'garbage')).toBeNull()
  })
})

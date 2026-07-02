import fc from 'fast-check'
import { describe, it } from 'vitest'
import {
  addDays,
  addMonths,
  addYears,
  clampDate,
  dayOfWeek,
  diffDays,
  diffMonths,
  eachDay,
  formatPlain,
  formatPlainRange,
  isPlainDate,
  parsePlainDate,
  plainDate,
  startOfWeek,
  toUtcMidnight,
  type PlainDate,
  type WeekDay,
} from './plain-date'
import { formatElapsed, isValidTimeZone, parseInstant, zone } from './zone'

const arbPlainDate = fc
  .record({
    y: fc.integer({ min: 1, max: 9999 }),
    m: fc.integer({ min: 1, max: 12 }),
    d: fc.integer({ min: 1, max: 31 }),
  })
  .map(({ y, m, d }) => plainDate(y, m, d) ?? plainDate(y, m, 28)!)

const arbWeekDay = fc.integer({ min: 0, max: 6 }) as fc.Arbitrary<WeekDay>

const arbHostile = fc.oneof(
  fc.anything(),
  fc.string(),
  fc.double(),
  fc.date({ noInvalidDate: false }),
  fc.constantFrom(null, undefined, Number.NaN, Number.POSITIVE_INFINITY, '', '2026-13-99')
)

const ZONES = [
  'UTC',
  'America/Havana',
  'America/New_York',
  'Asia/Tokyo',
  'Australia/Lord_Howe',
  'Pacific/Kiritimati',
  'Asia/Kathmandu',
]

describe('totality: parse and construct', () => {
  it('parsePlainDate never throws and only returns null or a valid PlainDate', () => {
    fc.assert(
      fc.property(arbHostile, (v) => {
        const r = parsePlainDate(v)
        return r === null || isPlainDate(r)
      })
    )
  })

  it('plainDate never throws on arbitrary numbers', () => {
    fc.assert(
      fc.property(fc.double(), fc.double(), fc.double(), (y, m, d) => {
        const r = plainDate(y, m, d)
        return r === null || isPlainDate(r)
      })
    )
  })

  it('isPlainDate never throws on anything', () => {
    fc.assert(fc.property(arbHostile, (v) => typeof isPlainDate(v) === 'boolean'))
  })

  it('parseInstant never throws and only returns null or a valid Date', () => {
    fc.assert(
      fc.property(arbHostile, (v) => {
        const r = parseInstant(v)
        return r === null || !Number.isNaN(r.getTime())
      })
    )
  })
})

describe('totality: round-trips and arithmetic laws', () => {
  it('toUtcMidnight → parsePlainDate is the identity for every valid day', () => {
    fc.assert(fc.property(arbPlainDate, (pd) => parsePlainDate(toUtcMidnight(pd)) === pd))
  })

  it('addDays returns a valid day and diffDays inverts it (or clamps to pd)', () => {
    fc.assert(
      fc.property(arbPlainDate, fc.integer({ min: -4_000_000, max: 4_000_000 }), (pd, n) => {
        const r = addDays(pd, n)
        return isPlainDate(r) && (r === pd || diffDays(r, pd) === n)
      })
    )
  })

  it('addDays/addMonths/addYears never throw on hostile n', () => {
    fc.assert(
      fc.property(arbPlainDate, fc.double(), (pd, n) => {
        return (
          isPlainDate(addDays(pd, n)) &&
          isPlainDate(addMonths(pd, n)) &&
          isPlainDate(addYears(pd, n))
        )
      })
    )
  })

  it('diffMonths sign agrees with order and is zero on equal days', () => {
    fc.assert(
      fc.property(arbPlainDate, arbPlainDate, (a, b) => {
        const dm = diffMonths(a, b)
        if (a === b) return dm === 0
        if (a > b) return dm >= 0
        return dm <= 0
      })
    )
  })

  it('startOfWeek lands on the configured week day', () => {
    fc.assert(
      fc.property(arbPlainDate, arbWeekDay, (pd, w) => {
        const start = startOfWeek(pd, w)
        const isoOfW = ((w + 6) % 7) + 1
        return dayOfWeek(start) === isoOfW && start <= pd && diffDays(pd, start) < 7
      })
    )
  })

  it('eachDay length equals diffDays + 1', () => {
    fc.assert(
      fc.property(arbPlainDate, fc.integer({ min: 0, max: 400 }), (from, n) => {
        const to = addDays(from, n)
        return eachDay(from, to).length === diffDays(to, from) + 1
      })
    )
  })

  it('clampDate always lands inside the bounds', () => {
    fc.assert(
      fc.property(arbPlainDate, arbPlainDate, arbPlainDate, (pd, x, y) => {
        const [min, max] = x <= y ? [x, y] : [y, x]
        const r = clampDate(pd, min, max)
        return r >= min && r <= max
      })
    )
  })
})

describe('totality: formatting', () => {
  it('formatPlain never throws on arbitrary locales and returns a string', () => {
    fc.assert(
      fc.property(arbPlainDate, fc.string(), (pd, locale) => {
        return typeof formatPlain(pd, locale) === 'string'
      })
    )
  })

  it('formatPlainRange never throws regardless of order or locale', () => {
    fc.assert(
      fc.property(arbPlainDate, arbPlainDate, fc.string(), (a, b, locale) => {
        return typeof formatPlainRange(a, b, locale) === 'string'
      })
    )
  })

  it('formatElapsed never throws on hostile input', () => {
    fc.assert(
      fc.property(arbHostile, arbHostile, (a, b) => {
        const r = formatElapsed(a as never, b as never)
        return r === null || typeof r === 'string'
      })
    )
  })
})

describe('totality: zone', () => {
  it('zone() never throws on arbitrary zone names', () => {
    fc.assert(
      fc.property(fc.string(), (tz) => {
        const z = zone(tz)
        return typeof z.timeZone === 'string' && isPlainDate(z.today())
      })
    )
  })

  it('isValidTimeZone never throws', () => {
    fc.assert(fc.property(fc.string(), (tz) => typeof isValidTimeZone(tz) === 'boolean'))
  })

  it('dayOf returns null or a valid day for hostile input, across zones', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ZONES), arbHostile, (tz, v) => {
        const r = zone(tz).dayOf(v as never)
        return r === null || isPlainDate(r)
      })
    )
  })

  it('startOfDay round-trips: its instant belongs to the requested day', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ZONES),
        fc.integer({ min: 1900, max: 2100 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (tz, y, m, d) => {
          const z = zone(tz)
          const pd = plainDate(y, m, d)!
          return z.dayOf(z.startOfDay(pd)) === pd
        }
      )
    )
  })

  it('ranges are always non-empty and ordered', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ZONES), arbPlainDate, (tz, pd) => {
        const z = zone(tz)
        const ranges = [z.dayRange(pd), z.weekRange(pd), z.monthRange(pd), z.yearRange(pd)]
        return ranges.every((r) => r.gte.getTime() < r.lt.getTime())
      })
    )
  })

  it('toInstant never throws on arbitrary time strings', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ZONES), arbPlainDate, fc.string(), (tz, pd, time) => {
        const r = zone(tz).toInstant(pd, time)
        return r === null || !Number.isNaN(r.getTime())
      })
    )
  })

  it('zone formatters never throw on hostile instants', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ZONES), arbHostile, (tz, v) => {
        const z = zone(tz)
        const time = z.formatTime(v as never)
        const inst = z.formatInstant(v as never)
        const rel = z.formatRelative(v as never)
        return (
          (time === null || typeof time === 'string') &&
          (inst === null || typeof inst === 'string') &&
          (rel === null || typeof rel === 'string')
        )
      })
    )
  })
})

describe('totality: branded values stay well-formed', () => {
  it('every produced PlainDate matches the brand contract', () => {
    fc.assert(
      fc.property(arbPlainDate, fc.integer({ min: -5000, max: 5000 }), (pd, n) => {
        const produced: PlainDate[] = [addDays(pd, n), addMonths(pd, n), startOfWeek(pd)]
        return produced.every((p) => isPlainDate(p))
      })
    )
  })
})

import {
  addDays,
  addYears,
  addMonths,
  formatPlain,
  isPlainDate,
  startOfWeek,
  startOfMonth,
  startOfYear,
  toUtcMidnight,
  formatPlainRange,
  type PlainDate,
  type WeekDay,
} from './plain-date'
import { cachedDateTimeFormat, cachedRelativeTimeFormat } from './intl-cache'

/** An instant: `Date`, epoch millis, or a parseable datetime string. */
export type DateInput = Date | string | number

export type FormatInstantOptions = Intl.DateTimeFormatOptions

export interface ZoneOptions {
  locale?: string | string[]
  /** 0=Sunday … 6=Saturday. Default 1 (Monday). */
  weekStartsOn?: WeekDay
}

/** Half-open instant range `[gte, lt)` — the shape timestamp query filters expect. */
export interface InstantRange {
  gte: Date
  lt: Date
}

export interface Zone {
  /** Resolved IANA zone. `'UTC'` if the requested one was invalid. */
  readonly timeZone: string
  readonly locale: string | string[] | undefined
  readonly weekStartsOn: WeekDay
  /** Today as a `PlainDate` in this zone. */
  today(): PlainDate
  /** Calendar day of this zone containing `instant`. `null` on invalid input. */
  dayOf(instant: DateInput): PlainDate | null
  /** Instant of local midnight of `pd` (default today). On DST gaps, the first existing instant of the day. */
  startOfDay(pd?: PlainDate): Date
  /** Instant where the week containing `pd` (default today) starts. */
  startOfWeek(pd?: PlainDate): Date
  /** Instant of `pd` at local wall-clock `time` (`'HH:mm'` or `'HH:mm:ss'`, default midnight). `null` on invalid time. */
  toInstant(pd: PlainDate, time?: string): Date | null
  /** `[gte, lt)` instants covering the local day `pd` (default today). */
  dayRange(pd?: PlainDate): InstantRange
  /** `[gte, lt)` instants covering the local week containing `pd` (default today). */
  weekRange(pd?: PlainDate): InstantRange
  /** `[gte, lt)` instants covering the local month containing `pd` (default today). */
  monthRange(pd?: PlainDate): InstantRange
  /** `[gte, lt)` instants covering the local year containing `pd` (default today). */
  yearRange(pd?: PlainDate): InstantRange
  /** `[gte, lt)` instants covering the local days `[from, to]`, inclusive. */
  rangeBetween(from: PlainDate, to: PlainDate): InstantRange
  isToday(pd: PlainDate): boolean
  isPast(pd: PlainDate): boolean
  isFuture(pd: PlainDate): boolean
  /** `formatPlain` with this zone's locale preset. */
  format(pd: PlainDate, options?: Intl.DateTimeFormatOptions): string
  /** `formatPlainRange` with this zone's locale preset (`'Jul 1 – 15, 2026'`). */
  formatRange(from: PlainDate, to: PlainDate, options?: Intl.DateTimeFormatOptions): string
  /** Time of `instant` in this zone, `'14:05'` by default. `null` on invalid input. */
  formatTime(instant: DateInput, options?: FormatInstantOptions): string | null
  /** Date and time of `instant` in this zone. `null` on invalid input. */
  formatInstant(instant: DateInput, options?: FormatInstantOptions): string | null
  /** Localized relative time (`'5 minutes ago'`, `'tomorrow'`). `null` on invalid input. */
  formatRelative(instant: DateInput, options?: { now?: DateInput }): string | null
}

/** `true` if `timeZone` is an IANA zone this runtime's `Intl` understands. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

const MIN_INSTANT = -62135596800000 // 0001-01-01T00:00:00Z
const MAX_INSTANT = 253402300799999 // 9999-12-31T23:59:59.999Z

/**
 * The boundary for instants: `Date`, epoch millis, or a parseable datetime string → `Date`.
 * Returns `null` instead of throwing on anything else, including `Invalid Date`, `NaN`, and `null`
 * (which `new Date(null)` would silently turn into the 1970 epoch).
 */
export function parseInstant(value: unknown): Date | null {
  if (value instanceof Date || typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/

function parseTimeMs(time: string): number | null {
  const m = TIME_RE.exec(time)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  const s = Number(m[3] ?? 0)
  if (h > 23 || min > 59 || s > 59) return null
  return (h * 3600 + min * 60 + s) * 1000
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = cachedDateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const p: Record<string, string> = {}
  for (const { type, value } of dtf.formatToParts(date)) p[type] = value
  const asUTC = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!)
  return asUTC - date.getTime()
}

function wallClockToInstant(
  pd: PlainDate,
  msOfDay: number,
  timeZone: string,
  dayIn: (d: Date) => PlainDate
): Date {
  const guess = toUtcMidnight(pd).getTime() + msOfDay
  const offset = tzOffsetMs(new Date(guess), timeZone)
  const first = new Date(guess - offset)
  const offsetAtFirst = tzOffsetMs(first, timeZone)
  if (offsetAtFirst === offset) return first
  const second = new Date(guess - offsetAtFirst)
  const valid = [first, second]
    .filter((c) => dayIn(c) === pd)
    .sort((a, b) => a.getTime() - b.getTime())
  return valid[0] ?? first
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_557_600_000],
  ['month', 2_629_800_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

/**
 * Binds an IANA zone (plus optional locale and week start) into a configured, total API.
 * Never throws: an invalid zone resolves to `'UTC'` — check `isValidTimeZone` or the
 * `timeZone` field if you need to detect that.
 */
export function zone(timeZone: string, options: ZoneOptions = {}): Zone {
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC'
  const { locale } = options
  const weekStartsOn: WeekDay =
    options.weekStartsOn !== undefined && Number.isInteger(options.weekStartsOn)
      ? ((((options.weekStartsOn % 7) + 7) % 7) as WeekDay)
      : 1

  const dayFormatter = cachedDateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const dayIn = (d: Date) => {
    const p: Record<string, string> = {}
    for (const { type, value } of dayFormatter.formatToParts(d)) p[type] = value
    return `${p.year!.padStart(4, '0')}-${p.month!}-${p.day!}` as PlainDate
  }
  const today = () => dayIn(new Date())
  const midnight = (pd: PlainDate) => wallClockToInstant(pd, 0, tz, dayIn)
  // next === from means arithmetic saturated at year 9999: close at the end of representable time.
  const range = (from: PlainDate, next: PlainDate): InstantRange => ({
    gte: midnight(from),
    lt: next === from ? new Date(MAX_INSTANT + 1) : midnight(next),
  })

  return {
    timeZone: tz,
    locale,
    weekStartsOn,
    today,
    dayOf: (instant) => {
      const d = parseInstant(instant)
      if (!d || d.getTime() < MIN_INSTANT || d.getTime() > MAX_INSTANT) return null
      const pd = dayIn(d)
      return isPlainDate(pd) ? pd : null
    },
    startOfDay: (pd = today()) => midnight(pd),
    startOfWeek: (pd = today()) => midnight(startOfWeek(pd, weekStartsOn)),
    toInstant: (pd, time) => {
      if (time === undefined) return midnight(pd)
      const ms = parseTimeMs(time)
      return ms === null ? null : wallClockToInstant(pd, ms, tz, dayIn)
    },
    dayRange: (pd = today()) => range(pd, addDays(pd, 1)),
    weekRange: (pd = today()) => {
      const start = startOfWeek(pd, weekStartsOn)
      return range(start, addDays(start, 7))
    },
    monthRange: (pd = today()) => {
      const start = startOfMonth(pd)
      return range(start, addMonths(start, 1))
    },
    yearRange: (pd = today()) => {
      const start = startOfYear(pd)
      return range(start, addYears(start, 1))
    },
    rangeBetween: (from, to) => {
      const [lo, hi] = from <= to ? [from, to] : [to, from]
      return range(lo, addDays(hi, 1))
    },
    isToday: (pd) => pd === today(),
    isPast: (pd) => pd < today(),
    isFuture: (pd) => pd > today(),
    format: (pd, opts) => formatPlain(pd, locale, opts),
    formatRange: (from, to, opts) => formatPlainRange(from, to, locale, opts),
    formatTime: (instant, opts) => {
      const d = parseInstant(instant)
      if (!d) return null

      try {
        return cachedDateTimeFormat(locale, {
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
          ...opts,
          timeZone: opts?.timeZone ?? tz,
        }).format(d)
      } catch {
        return d.toISOString().slice(11, 16)
      }
    },
    formatInstant: (instant, opts) => {
      const d = parseInstant(instant)
      if (!d) return null

      try {
        const base: Intl.DateTimeFormatOptions =
          opts && Object.keys(opts).length ? opts : { dateStyle: 'medium', timeStyle: 'short' }

        return cachedDateTimeFormat(locale, { ...base, timeZone: opts?.timeZone ?? tz }).format(d)
      } catch {
        return d.toISOString()
      }
    },
    formatRelative: (instant, opts) => {
      const d = parseInstant(instant)
      const now = parseInstant(opts?.now ?? Date.now())

      if (!d || !now) return null
      const diff = d.getTime() - now.getTime()

      try {
        const rtf = cachedRelativeTimeFormat(locale)
        const abs = Math.abs(diff)

        for (const [unit, ms] of RELATIVE_UNITS) {
          if (abs >= ms) return rtf.format(Math.trunc(diff / ms), unit)
        }

        return rtf.format(Math.trunc(diff / 1000), 'second')
      } catch {
        return d.toISOString()
      }
    },
  }
}

/** Elapsed time in compact form: `'5m'`, `'1h 30m'`. Negatives clamp to `'0m'`; `null` on invalid input. */
export function formatElapsed(from: DateInput, to: DateInput = Date.now()): string | null {
  const f = parseInstant(from)
  const t = parseInstant(to)
  if (!f || !t) return null
  const mins = Math.max(0, Math.floor((t.getTime() - f.getTime()) / 60_000))
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

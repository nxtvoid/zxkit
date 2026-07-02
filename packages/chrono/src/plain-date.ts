import { cachedDateTimeFormat } from './intl-cache'

/** A pure calendar day as a branded `'YYYY-MM-DD'` string — the semantics of a SQL `DATE` column. */
export type PlainDate = string & { readonly __brand: 'PlainDate' }

/** Components of a `PlainDate`. `month` is 1-12. */
export interface PlainDateParts {
  year: number
  month: number
  day: number
}

/** 0=Sunday … 6=Saturday. */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6

const PLAIN_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000
const MIN_YEAR = 1
const MAX_YEAR = 9999

// Not Date.UTC(year, …): it maps years 0-99 to 1900-1999. setUTCFullYear does not.
function utcTime(year: number, monthIndex: number, day: number): number {
  const d = new Date(0)
  d.setUTCFullYear(year, monthIndex, day)
  return d.getTime()
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(utcTime(year, monthIndex + 1, 0)).getUTCDate()
}

function build(year: number, month: number, day: number): PlainDate {
  const y = `${year}`.padStart(4, '0')
  const m = `${month}`.padStart(2, '0')
  const d = `${day}`.padStart(2, '0')
  return `${y}-${m}-${d}` as PlainDate
}

function fromUtcComponents(date: Date): PlainDate {
  return build(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

function epochUTC(pd: PlainDate): number {
  const { year, month, day } = toParts(pd)
  return utcTime(year, month - 1, day)
}

/** `true` if the value is a `'YYYY-MM-DD'` string naming a real calendar day. */
export function isPlainDate(value: unknown): value is PlainDate {
  if (typeof value !== 'string' || !PLAIN_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number) as [number, number, number]
  return y >= MIN_YEAR && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m - 1)
}

/**
 * The single boundary into the domain. Accepts `'YYYY-MM-DD'` strings, `Date`,
 * or epoch millis (`Date`/millis are read by their UTC components — the shape a
 * SQL `DATE` column comes back in). Returns `null` instead of throwing.
 */
export function parsePlainDate(value: unknown): PlainDate | null {
  if (typeof value === 'string') return isPlainDate(value) ? value : null
  if (value instanceof Date || typeof value === 'number') {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getUTCFullYear()
    if (y < MIN_YEAR || y > MAX_YEAR) return null
    return fromUtcComponents(d)
  }
  return null
}

/** Builds a `PlainDate` from components (`month` 1-12). `null` if they don't name a real day. */
export function plainDate(year: number, month: number, day: number): PlainDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (year < MIN_YEAR || year > MAX_YEAR) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(year, month - 1)) return null
  return build(year, month, day)
}

/** `{ year, month, day }` of a `PlainDate`. `month` is 1-12. */
export function toParts(pd: PlainDate): PlainDateParts {
  const [year, month, day] = pd.split('-').map(Number) as [number, number, number]
  return { year, month, day }
}

/** `PlainDate` → `Date` at UTC midnight, ready to write into a SQL `DATE` column. */
export function toUtcMidnight(pd: PlainDate): Date {
  return new Date(epochUTC(pd))
}

/** ISO day of week: 1=Monday … 7=Sunday. */
export function dayOfWeek(pd: PlainDate): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return (((toUtcMidnight(pd).getUTCDay() + 6) % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7
}

/** -1 if `a` is earlier, 0 if equal, 1 if later. */
export function compare(a: PlainDate, b: PlainDate): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0
}

export function isSameDay(a: PlainDate, b: PlainDate): boolean {
  return a === b
}

export function isSameMonth(a: PlainDate, b: PlainDate): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

export function isSameYear(a: PlainDate, b: PlainDate): boolean {
  return a.slice(0, 4) === b.slice(0, 4)
}

export function isBefore(a: PlainDate, b: PlainDate): boolean {
  return a < b
}

export function isAfter(a: PlainDate, b: PlainDate): boolean {
  return a > b
}

export function isSameOrBefore(a: PlainDate, b: PlainDate): boolean {
  return a <= b
}

export function isSameOrAfter(a: PlainDate, b: PlainDate): boolean {
  return a >= b
}

export function minDate(...dates: [PlainDate, ...PlainDate[]]): PlainDate {
  return dates.reduce((a, b) => (a < b ? a : b))
}

export function maxDate(...dates: [PlainDate, ...PlainDate[]]): PlainDate {
  return dates.reduce((a, b) => (a > b ? a : b))
}

/** Adds `n` days (may be negative). Non-finite `n` or a result outside year 1-9999 returns `pd` unchanged. */
export function addDays(pd: PlainDate, n: number): PlainDate {
  if (!Number.isFinite(n)) return pd
  const d = new Date(epochUTC(pd) + Math.trunc(n) * DAY_MS)
  if (Number.isNaN(d.getTime())) return pd
  const y = d.getUTCFullYear()
  if (y < MIN_YEAR || y > MAX_YEAR) return pd
  return fromUtcComponents(d)
}

/**
 * Adds `n` months, clamping to the last day of the target month (Jan 31 +1 → Feb 28/29).
 * Non-finite `n` or a result outside year 1-9999 returns `pd` unchanged.
 */
export function addMonths(pd: PlainDate, n: number): PlainDate {
  if (!Number.isFinite(n)) return pd
  const { year, month, day } = toParts(pd)
  const total = month - 1 + Math.trunc(n)
  const targetYear = year + Math.floor(total / 12)
  if (targetYear < MIN_YEAR || targetYear > MAX_YEAR) return pd
  const monthIndex = ((total % 12) + 12) % 12
  return build(targetYear, monthIndex + 1, Math.min(day, daysInMonth(targetYear, monthIndex)))
}

/** Adds `n` years, clamping Feb 29 → Feb 28 on non-leap targets. Same guards as `addMonths`. */
export function addYears(pd: PlainDate, n: number): PlainDate {
  if (!Number.isFinite(n)) return pd
  return addMonths(pd, Math.trunc(n) * 12)
}

/** Calendar days between `a` and `b` (`a - b`). */
export function diffDays(a: PlainDate, b: PlainDate): number {
  return Math.round((epochUTC(a) - epochUTC(b)) / DAY_MS)
}

/** Whole months between `a` and `b` (`a - b`), truncated toward zero, consistent with `addMonths` clamping. */
export function diffMonths(a: PlainDate, b: PlainDate): number {
  const pa = toParts(a)
  const pb = toParts(b)
  let months = (pa.year - pb.year) * 12 + (pa.month - pb.month)
  if (months > 0 && addMonths(b, months) > a) months--
  else if (months < 0 && addMonths(b, months) < a) months++
  return months
}

/** Whole years between `a` and `b` (`a - b`), truncated toward zero. */
export function diffYears(a: PlainDate, b: PlainDate): number {
  return Math.trunc(diffMonths(a, b) / 12)
}

export function startOfMonth(pd: PlainDate): PlainDate {
  const { year, month } = toParts(pd)
  return build(year, month, 1)
}

export function endOfMonth(pd: PlainDate): PlainDate {
  const { year, month } = toParts(pd)
  return build(year, month, daysInMonth(year, month - 1))
}

export function startOfYear(pd: PlainDate): PlainDate {
  return build(toParts(pd).year, 1, 1)
}

export function endOfYear(pd: PlainDate): PlainDate {
  return build(toParts(pd).year, 12, 31)
}

/** First day of the week containing `pd`. Default Monday. */
export function startOfWeek(pd: PlainDate, weekStartsOn: WeekDay = 1): PlainDate {
  const diff = (toUtcMidnight(pd).getUTCDay() - weekStartsOn + 7) % 7
  return addDays(pd, -diff)
}

/** Last day of the week containing `pd`. Default Monday start (→ Sunday end). */
export function endOfWeek(pd: PlainDate, weekStartsOn: WeekDay = 1): PlainDate {
  return addDays(startOfWeek(pd, weekStartsOn), 6)
}

/** `pd` clamped into `[min, max]`. */
export function clampDate(pd: PlainDate, min: PlainDate, max: PlainDate): PlainDate {
  return pd < min ? min : pd > max ? max : pd
}

/** `pd` is within `[from, to]`, inclusive. */
export function isBetween(pd: PlainDate, from: PlainDate, to: PlainDate): boolean {
  return pd >= from && pd <= to
}

/** Inclusive list of days from `from` through `to`. Empty if `from > to`. */
export function eachDay(from: PlainDate, to: PlainDate): PlainDate[] {
  const out: PlainDate[] = []
  for (let cur = from; cur <= to; cur = addDays(cur, 1)) out.push(cur)
  return out
}

/** First day of each month touched by `[from, to]`, inclusive. Empty if `from > to`. */
export function eachMonth(from: PlainDate, to: PlainDate): PlainDate[] {
  const out: PlainDate[] = []
  const last = startOfMonth(to)
  for (let cur = startOfMonth(from); cur <= last && from <= to; cur = addMonths(cur, 1)) {
    out.push(cur)
  }
  return out
}

/** Inclusive `[from, to]` as UTC-midnight `Date`s — the shape a SQL `DATE` column compares against. */
export interface UtcDateRange {
  gte: Date
  lte: Date
}

/** Bounds for querying a SQL `DATE` column over `[from, to]`, inclusive. */
export function toUtcRange(from: PlainDate, to: PlainDate): UtcDateRange {
  return { gte: toUtcMidnight(from), lte: toUtcMidnight(to) }
}

/**
 * Formats `[from, to]` via `Intl.DateTimeFormat#formatRange` pinned to UTC (`'Jul 1 – 15, 2026'`;
 * equal days collapse to one date). Never throws: bad locales/options fall back to `'from – to'` ISO.
 */
export function formatPlainRange(
  from: PlainDate,
  to: PlainDate,
  locale?: string | string[],
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const opts: Intl.DateTimeFormatOptions =
      options && Object.keys(options).length
        ? options
        : { year: 'numeric', month: 'long', day: 'numeric' }
    return cachedDateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).formatRange(
      toUtcMidnight(minDate(from, to)),
      toUtcMidnight(maxDate(from, to))
    )
  } catch {
    return `${from} – ${to}`
  }
}

/**
 * Formats via `Intl.DateTimeFormat` pinned to UTC so the day never shifts.
 * Defaults to a long date. Never throws: bad locales/options fall back to the ISO string.
 */
export function formatPlain(
  pd: PlainDate,
  locale?: string | string[],
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const opts: Intl.DateTimeFormatOptions =
      options && Object.keys(options).length
        ? options
        : { year: 'numeric', month: 'long', day: 'numeric' }
    return cachedDateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(toUtcMidnight(pd))
  } catch {
    return pd
  }
}

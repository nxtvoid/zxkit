# `@zxkit/chrono`

Zero-dependency calendar dates and timezone-aware instants, built on native `Intl`.

**The API is total — it never throws.** Invalid input at the boundary returns `null`; inside the domain every operation returns a valid value. TypeScript forces you to handle the `null` exactly once, where the data enters. After that, failure is unrepresentable.

- **`PlainDate`** — a branded `'YYYY-MM-DD'` string for pure calendar days: the exact semantics of a SQL `DATE` column. Serializes for free across RSC/JSON, compares natively with `<` `>` `===`, and mixing it with instants is a compile error.
- **`zone(timeZone)`** — binds an IANA zone (plus locale and week start) once, and answers the only questions that actually need a zone: which day contains this instant, and which instant starts that day.

## Install

```sh
bun add @zxkit/chrono
```

## Usage

One boundary in, then everything is infallible:

```ts
import { addMonths, diffDays, parsePlainDate, startOfMonth, toUtcMidnight } from '@zxkit/chrono'

// boundary: DB rows, user input, URL params — null instead of throw
const due = parsePlainDate(row.dueDate) // Date @ UTC midnight → PlainDate | null
if (!due) return badRequest()
const from = parsePlainDate(searchParams.from) ?? startOfMonth(due)

// domain: total, no failure paths
addMonths(due, 1) // clamps: Jan 31 + 1 → Feb 28/29
diffDays(due, from)
due < from // native comparison
toUtcMidnight(due) // → Date, ready to write back to a DATE column
```

Zone-dependent questions go through a configured `zone`:

```ts
import { zone } from '@zxkit/chrono'

const tz = zone('America/New_York', { locale: 'en-US' })

tz.today() // PlainDate of the day right now, in that zone
tz.dayOf(order.paidAt) // day containing that instant (null on garbage)
tz.startOfDay() // instant of today's local midnight — timestamp filters
tz.toInstant(due, '14:30') // 14:30 local wall clock of that day, as an instant
tz.isPast(due) // due < tz.today()
tz.format(due) // 'July 1, 2026'
tz.formatRange(from, to) // 'July 1 – 15, 2026'
tz.formatTime(order.paidAt) // '14:05'
tz.formatRelative(order.paidAt) // '5 minutes ago'
```

Query ranges come precomputed — the half-open `[gte, lt)` shape Prisma-style filters expect:

```ts
db.order.aggregate({ where: { paidAt: tz.monthRange() } }) // current local month
db.order.findMany({ where: { paidAt: tz.dayRange(day) } }) // one local day
db.order.findMany({ where: { paidAt: tz.rangeBetween(from, to) } }) // inclusive [from, to]

// DATE columns compare against UTC midnights, not zone instants:
db.invoice.findMany({ where: { issuedOn: toUtcRange(from, to) } }) // { gte, lte }
```

Recommended app adapter — the only place that knows your app's zone:

```ts
// server/app-date.ts
import { zone } from '@zxkit/chrono'

export const tz = zone(process.env.APP_TZ ?? 'America/New_York', {
  locale: 'en-US',
})

export { addDays, addMonths, diffDays, parsePlainDate, toUtcMidnight } from '@zxkit/chrono'
export type { PlainDate } from '@zxkit/chrono'
```

## Why it can't fail

| Input                                                                  | Behavior                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `parsePlainDate('2026-02-30')`, garbage strings, `Invalid Date`, `NaN` | `null` — decide the fallback once, at the boundary                  |
| `plainDate(2026, 13, 1)`                                               | `null`                                                              |
| `addDays(pd, NaN)`, `addMonths(pd, 1e12)`, results outside year 1-9999 | returns `pd` unchanged                                              |
| `formatPlain(pd, '!!bad-locale!!')`, conflicting `Intl` options        | falls back to the ISO string                                        |
| `zone('Mars/Olympus_Mons')`                                            | resolves to `'UTC'`; detect with `isValidTimeZone()` or `.timeZone` |
| `tz.dayOf('garbage')`, `tz.formatTime(NaN)`                            | `null`                                                              |
| DST transitions at midnight (skipped or repeated hour)                 | `startOfDay` returns the first existing instant of the day          |

## API

### `PlainDate` (pure, no timezone)

| Function                                                                                                                                                      | Notes                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `parsePlainDate(value)`                                                                                                                                       | the boundary: `'YYYY-MM-DD'`, `Date`, or epoch millis (UTC components) → `PlainDate \| null` |
| `plainDate(y, m, d)`                                                                                                                                          | components (`m` 1-12) → `PlainDate \| null`                                                  |
| `isPlainDate(v)`                                                                                                                                              | type guard; validates shape **and** that the day exists                                      |
| `toParts(pd)` / `toUtcMidnight(pd)` / `dayOfWeek(pd)`                                                                                                         | `{ year, month, day }` / `Date` for `DATE` columns / ISO 1-7                                 |
| `compare`, `isSameDay`, `isSameMonth`, `isSameYear`, `isBefore`, `isAfter`, `isSameOrBefore`, `isSameOrAfter`, `minDate`, `maxDate`, `clampDate`, `isBetween` | total order — plain string comparison                                                        |
| `addDays`, `addMonths`, `addYears`, `diffDays`, `diffMonths`, `diffYears`                                                                                     | UTC-epoch arithmetic; month/year ops clamp end of month                                      |
| `startOfMonth`, `endOfMonth`, `startOfWeek`, `endOfWeek`, `startOfYear`, `endOfYear`                                                                          | period boundaries                                                                            |
| `eachDay`, `eachMonth`, `toUtcRange`                                                                                                                          | iteration and inclusive `{ gte, lte }` bounds for `DATE` columns                             |
| `formatPlain(pd, locale?, opts?)` / `formatPlainRange(from, to, locale?, opts?)`                                                                              | `Intl` pinned to UTC so the day never shifts                                                 |

### `zone(timeZone, { locale?, weekStartsOn? })`

| Member                                                                                                                | Notes                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `today()`                                                                                                             | `PlainDate` in the zone                                                        |
| `dayOf(instant)`                                                                                                      | day containing the instant → `PlainDate \| null`                               |
| `startOfDay(pd?)` / `startOfWeek(pd?)`                                                                                | local midnight as an instant; default today; DST-gap safe                      |
| `toInstant(pd, time?)`                                                                                                | local wall clock (`'HH:mm[:ss]'`) → instant; `null` on bad time                |
| `dayRange(pd?)` / `weekRange(pd?)` / `monthRange(pd?)` / `yearRange(pd?)` / `rangeBetween(from, to)`                  | half-open `{ gte, lt }` instant ranges for timestamp filters                   |
| `isToday(pd)` / `isPast(pd)` / `isFuture(pd)`                                                                         | relative to `today()`                                                          |
| `format(pd, opts?)` / `formatRange(from, to, opts?)` / `formatTime(instant, opts?)` / `formatInstant(instant, opts?)` | locale preset; instant formatters return `null` on invalid input               |
| `formatRelative(instant, { now? })`                                                                                   | `Intl.RelativeTimeFormat`, `numeric: 'auto'` (`'5 minutes ago'`, `'tomorrow'`) |

Free helpers: `parseInstant(value)` (the instant boundary — `Date | null`, rejects `null`/objects that `new Date` would coerce), `isValidTimeZone(tz)`, `formatElapsed(from, to?)` (`'5m'`, `'1h 30m'`).

### Validating at the edge (zod)

```ts
import { isPlainDate, type PlainDate } from '@zxkit/chrono'

const schema = z.object({
  dueDate: z.custom<PlainDate>(isPlainDate, 'Invalid date'),
})
```

## License

MIT

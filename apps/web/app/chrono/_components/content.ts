export const boundaryExample = `import { parsePlainDate, addMonths, toUtcMidnight } from '@zxkit/chrono'

const due = parsePlainDate(row.dueDate) // PlainDate | null — never throws
if (!due) return badRequest()

addMonths(due, 1) // 'Jan 31' + 1 → 'Feb 28' — clamps, no overflow
due < tz.today() // native string comparison
toUtcMidnight(due) // Date at UTC midnight, ready for a DATE column`

export const zoneExample = `import { zone } from '@zxkit/chrono'

export const tz = zone(process.env.APP_TZ ?? 'America/New_York', {
  locale: 'en-US',
})

tz.today() // PlainDate of the current local day
tz.dayOf(order.paidAt) // day containing that instant
tz.startOfDay() // instant of today's local midnight
tz.toInstant(day, '14:30') // local wall clock → instant`

export const rangesExample = `db.order.aggregate({ where: { paidAt: tz.monthRange() } })
db.order.findMany({ where: { paidAt: tz.dayRange(day) } })
db.order.findMany({ where: { paidAt: tz.rangeBetween(from, to) } })

// DATE columns compare against UTC midnights instead
db.invoice.findMany({ where: { issuedOn: toUtcRange(from, to) } })`

export const formatExample = `tz.format(day) // 'July 1, 2026'
tz.formatRange(from, to) // 'July 1 – 15, 2026'
tz.formatTime(order.paidAt) // '14:05'
tz.formatRelative(order.paidAt) // '5 minutes ago'`

export const features = [
  {
    title: 'Total API',
    description:
      'Invalid input returns null at the boundary. Arithmetic saturates. Formatters fall back to ISO. Nothing throws.',
  },
  {
    title: 'Branded PlainDate',
    description:
      "A 'YYYY-MM-DD' string type: serializes across RSC and JSON for free, compares with < > ===, and never mixes with instants.",
  },
  {
    title: 'DATE column semantics',
    description:
      'parsePlainDate reads UTC midnights, toUtcMidnight writes them back. One boundary, no shifted days.',
  },
  {
    title: 'DST safe',
    description:
      'Midnights skipped or repeated by DST resolve to the first existing instant of the day, in any IANA zone.',
  },
  {
    title: 'Zero dependencies',
    description:
      'Native Intl only, with cached formatters. Identical results on server, edge, and client — whatever the process timezone.',
  },
]

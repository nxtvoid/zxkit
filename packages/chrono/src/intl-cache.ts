type Locale = string | string[] | undefined

const dtfCache = new Map<string, Intl.DateTimeFormat>()
const rtfCache = new Map<string, Intl.RelativeTimeFormat>()

const MAX_ENTRIES = 64

export function cachedDateTimeFormat(
  locale: Locale,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const key = `${JSON.stringify(locale)}|${JSON.stringify(options)}`
  let f = dtfCache.get(key)
  if (!f) {
    if (dtfCache.size >= MAX_ENTRIES) dtfCache.clear()
    f = new Intl.DateTimeFormat(locale, options)
    dtfCache.set(key, f)
  }
  return f
}

export function cachedRelativeTimeFormat(locale: Locale): Intl.RelativeTimeFormat {
  const key = JSON.stringify(locale) ?? ''
  let f = rtfCache.get(key)
  if (!f) {
    if (rtfCache.size >= MAX_ENTRIES) rtfCache.clear()
    f = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    rtfCache.set(key, f)
  }
  return f
}

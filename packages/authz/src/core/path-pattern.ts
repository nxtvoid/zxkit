export function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.*]/g, '\\$&')
}

// Maps "/orders/:id/:path*" style patterns to an unanchored regex source.
// Callers add anchors and prefix/exact semantics. May return '' for "/".
export function pathPatternToRegexSource(pattern: string) {
  const normalized = pattern.startsWith('/') ? pattern : `/${pattern}`

  return normalized
    .split('/')
    .filter(Boolean)
    .map((token) => {
      if (token === ':path*') {
        return '(?:/.+)?'
      }

      if (token.startsWith(':')) {
        return '/[^/]+'
      }

      return `/${escapeRegex(token)}`
    })
    .join('')
}

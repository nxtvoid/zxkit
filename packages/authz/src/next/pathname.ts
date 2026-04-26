type PathPattern = string | readonly string[]

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}

function patternToRegex(pattern: string) {
  if (pattern === '*') {
    return /^.*$/
  }

  const normalized = pattern.startsWith('/') ? pattern : `/${pattern}`
  const tokens = normalized.split('/').filter(Boolean)
  const regex = tokens
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

  return new RegExp(`^${regex || '/'}$`)
}

export function matchesPathname(pattern: PathPattern, pathname: string) {
  const patterns = Array.isArray(pattern) ? pattern : [pattern]
  return patterns.some((entry) => patternToRegex(entry).test(pathname))
}

export type { PathPattern }

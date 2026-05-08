type PathPattern = string | readonly string[]

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}

const regexCache = new Map<string, RegExp>()

function patternToRegex(pattern: string) {
  const cached = regexCache.get(pattern)
  if (cached) return cached

  let result: RegExp

  if (pattern === '*') {
    result = /^.*$/
  } else {
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

    result = new RegExp(`^${regex || '/'}$`)
  }

  regexCache.set(pattern, result)
  return result
}

export function matchesPathname(pattern: PathPattern, pathname: string) {
  const patterns = Array.isArray(pattern) ? pattern : [pattern]
  return patterns.some((entry) => patternToRegex(entry).test(pathname))
}

export type { PathPattern }

import { pathPatternToRegexSource } from '../core/path-pattern'

type PathPattern = string | readonly string[]

const REGEX_CACHE_LIMIT = 1000

const regexCache = new Map<string, RegExp>()

function patternToRegex(pattern: string) {
  const cached = regexCache.get(pattern)
  if (cached) return cached

  const result =
    pattern === '*' ? /^.*$/ : new RegExp(`^${pathPatternToRegexSource(pattern) || '/'}$`)

  if (regexCache.size >= REGEX_CACHE_LIMIT) {
    regexCache.clear()
  }

  regexCache.set(pattern, result)
  return result
}

export function matchesPathname(pattern: PathPattern, pathname: string) {
  const patterns = Array.isArray(pattern) ? pattern : [pattern]
  return patterns.some((entry) => patternToRegex(entry).test(pathname))
}

export type { PathPattern }

import type { NextRequest } from 'next/server'
import type { AuthzProxyAuth } from './proxy-types'

const DEFAULT_RETURN_TO_PARAM = 'callbackUrl'

// URL needs an absolute base to parse a path-only target; the host is discarded.
const INTERNAL_BASE = 'http://internal.invalid'

export function resolveReturnToParam(returnTo: AuthzProxyAuth['returnTo']): string | null {
  if (!returnTo) {
    return null
  }

  return returnTo === true ? DEFAULT_RETURN_TO_PARAM : returnTo
}

/**
 * Non-throwing guard for untrusted redirect targets. Returns the normalized
 * internal path, or `null` when the value could escape to another host.
 *
 * String checks alone are not enough: URL parsing strips ASCII tabs/newlines
 * ("/\t/evil.com" becomes "//evil.com") and treats "\" as "/" in special
 * schemes ("/\evil.com" becomes "//evil.com"), so both resolve as
 * protocol-relative URLs pointing at an external host. Parse with the same
 * algorithm the redirect uses and require the origin to stay internal.
 *
 * The parsed result is validated again: dot-segment normalization can smuggle
 * a protocol-relative prefix past the origin check ("/..//evil.com" keeps the
 * internal origin but serializes to "//evil.com").
 */
export function toSafeInternalPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/')) {
    return null
  }

  let url: URL

  try {
    url = new URL(path, INTERNAL_BASE)
  } catch {
    return null
  }

  if (url.origin !== INTERNAL_BASE) {
    return null
  }

  const normalized = `${url.pathname}${url.search}${url.hash}`

  if (!normalized.startsWith('/') || normalized.startsWith('//') || normalized.startsWith('/\\')) {
    return null
  }

  return normalized
}

/**
 * Validates an untrusted return-to value (for example the `callbackUrl` query
 * param read inside a sign-in page) and falls back when it is missing or could
 * redirect to another host. Never throws.
 *
 * ```ts
 * const target = sanitizeReturnTo(searchParams.get('callbackUrl'), '/hub')
 * ```
 */
export function sanitizeReturnTo(value: string | null | undefined, fallback: string): string {
  return toSafeInternalPath(value) ?? fallback
}

export function appendReturnTo(target: string, param: string, returnPath: string) {
  const url = new URL(target, INTERNAL_BASE)
  url.searchParams.set(param, returnPath)

  return `${url.pathname}${url.search}${url.hash}`
}

export function readReturnTo(request: NextRequest, param: string): string | null {
  return toSafeInternalPath(request.nextUrl.searchParams.get(param))
}

const MAX_LISTED_NAMES = 8

function byLikenessTo(target: string) {
  const needle = target.toLowerCase()

  const score = (candidate: string) => {
    const other = candidate.toLowerCase()
    if (other === needle) return 3
    if (other.includes(needle) || needle.includes(other)) return 2

    let shared = 0
    while (shared < other.length && shared < needle.length && other[shared] === needle[shared]) {
      shared += 1
    }
    return shared === 0 ? 0 : 1 + shared / needle.length
  }

  return (a: string, b: string) => score(b) - score(a)
}

/**
 * Formats known names for an error: closest to `target` first, capped with a
 * `+N more` count so a large registry does not bury the message.
 */
export function listNames(target: string, known: string[]) {
  const ranked = [...known].sort(byLikenessTo(target))
  const shown = ranked.slice(0, MAX_LISTED_NAMES)
  const hidden = ranked.length - shown.length

  return hidden > 0 ? `${shown.join(', ')}, +${hidden} more` : shown.join(', ')
}

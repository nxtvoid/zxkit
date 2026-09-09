/** Observe only during a morph; never run a permanent animation loop. */
export function waitForGeometry(
  matches: () => boolean,
  complete: () => void,
  fallbackMs: number,
  consecutiveFrames = 1
): () => void {
  let frame = 0
  let matching = 0
  let done = false

  const finish = () => {
    if (done) return

    done = true
    cancelAnimationFrame(frame)
    clearTimeout(fallback)
    complete()
  }

  const sample = () => {
    matching = matches() ? matching + 1 : 0
    if (matching >= consecutiveFrames) finish()
    else frame = requestAnimationFrame(sample)
  }

  const fallback = setTimeout(finish, fallbackMs)
  frame = requestAnimationFrame(sample)

  return () => {
    done = true
    cancelAnimationFrame(frame)
    clearTimeout(fallback)
  }
}

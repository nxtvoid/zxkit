'use client'

import { NOTI_CSS } from './css.generated'

/** Guards against a second outlet, or a hot reload, stacking copies. */
const MARKER = 'data-noti-styles'

/**
 * Puts the stylesheet in the document, once. The CSS ships inside the JS, so
 * there is no `styles.css` import to forget.
 *
 * Goes **first** in `<head>`: prepending lets the app's own stylesheet win at
 * equal specificity, which is what a library's defaults should do.
 */
export function injectNotiStyles(nonce?: string): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[${MARKER}]`) !== null) return

  const style = document.createElement('style')
  style.setAttribute(MARKER, '')
  // Before insertion: a nonce set afterwards is one the CSP already rejected.
  if (nonce !== undefined) style.nonce = nonce
  style.textContent = NOTI_CSS

  document.head.prepend(style)
}

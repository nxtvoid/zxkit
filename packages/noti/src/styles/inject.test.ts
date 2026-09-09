// @vitest-environment jsdom

import { afterEach, expect, it } from 'vitest'
import { injectNotiStyles } from './inject'
import { NOTI_CSS } from './css.generated'

afterEach(() => {
  document.querySelectorAll('style[data-noti-styles]').forEach((style) => {
    style.remove()
  })
})

it('updates a stale stylesheet in place after hot reload, preserving its nonce', () => {
  const existing = document.createElement('style')
  existing.setAttribute('data-noti-styles', '')
  existing.nonce = 'test-nonce'
  existing.textContent = '[data-noti-close] { display: none; }'
  document.head.prepend(existing)

  injectNotiStyles()

  expect(document.querySelectorAll('style[data-noti-styles]')).toHaveLength(1)
  expect(document.querySelector('style[data-noti-styles]')).toBe(existing)
  expect(existing.textContent).toBe(NOTI_CSS)
  expect(existing.nonce).toBe('test-nonce')
})

it('keeps repeated injection idempotent', () => {
  injectNotiStyles('nonce')
  const existing = document.querySelector('style[data-noti-styles]')!
  const text = existing.firstChild
  injectNotiStyles('nonce')
  expect(document.querySelectorAll('style[data-noti-styles]')).toHaveLength(1)
  expect(existing.firstChild).toBe(text)
})

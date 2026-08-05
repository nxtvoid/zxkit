import { describe, expect, it } from 'vitest'

import { buildNotiCss, squeezeCss } from '../../scripts/generate-css'
import { SPRING_DURATION } from '../core/constants'
import { SETTLE, SPRING } from '../motion/springs'
import { NOTI_CSS } from './css.generated'

/**
 * Every block opened by `marker`, closed by brace matching.
 *
 * Splitting on the at-rule would not do: the text after a block's closing brace
 * belongs to the same slice, so an unguarded rule would look guarded.
 */
function blocksOf(css: string, marker: string): string[] {
  const blocks: string[] = []
  let from = css.indexOf(marker)

  while (from !== -1) {
    let depth = 0
    let index = from + marker.length - 1

    for (; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1
      else if (css[index] === '}' && --depth === 0) break
    }

    blocks.push(css.slice(from, index + 1))
    from = css.indexOf(marker, index + 1)
  }

  return blocks
}

describe('the shipped stylesheet', () => {
  it('matches the CSS sources it was generated from', async () => {
    // The one thing a generated-and-committed file has to be protected from.
    // If this fails, run `bun scripts/generate-css.ts`.
    expect(NOTI_CSS).toBe(await buildNotiCss())
  })

  it('carries the tokens and the stylesheet, and no import between them', () => {
    expect(NOTI_CSS).toContain('--noti-spring:')
    expect(NOTI_CSS).toContain('[data-noti-island-pill]')
    expect(NOTI_CSS).not.toContain('@import')
  })

  it('keeps the media queries and the spring curve intact', () => {
    expect(NOTI_CSS).toContain('@media (prefers-reduced-motion: reduce)')
    expect(NOTI_CSS).toContain('@media (forced-colors: active)')
    // Whitespace inside a value is a separator, not a quantity — but it still
    // has to survive, or the spring stops being a spring.
    expect(NOTI_CSS).toContain('1.038 45%')
    expect(NOTI_CSS).toContain('color-mix(in oklch,var(--noti-accent) 20%,transparent)')
  })

  it('gates every hover effect behind a pointer that can leave', () => {
    const count = (source: string) => source.split(':hover').length - 1
    const guarded = blocksOf(NOTI_CSS, '@media (hover: hover) and (pointer: fine){')

    // A tap latches `:hover` on touch, lighting a control nobody is hovering.
    // Every one of them has to sit inside the guard, not just the first.
    expect(count(NOTI_CSS)).toBeGreaterThan(0)
    expect(guarded.reduce((total, block) => total + count(block), 0)).toBe(count(NOTI_CSS))
  })

  it('publishes the same spring the Web Animations side runs on', () => {
    const valueOf = (name: string) => {
      const at = NOTI_CSS.indexOf(`${name}:`)
      return NOTI_CSS.slice(at + name.length + 1, NOTI_CSS.indexOf(';', at)).trim()
    }
    // Whitespace around commas and parentheses says nothing in CSS, and the two
    // sources wrap their curves differently. The numbers are the contract.
    const normalize = (value: string) => value.replace(/\s*([(),])\s*/g, '$1')

    // Two declarations of one spring: the stylesheet transitions on the token
    // and the Web Animations side reads it back, so drift here would leave the
    // silhouette and the heading running on different clocks.
    expect(valueOf('--noti-spring-duration')).toBe(`${SPRING_DURATION}ms`)
    expect(normalize(valueOf('--noti-spring'))).toBe(normalize(SPRING))
    expect(normalize(valueOf('--noti-settle'))).toBe(normalize(SETTLE))
  })

  it('delays the content fade on the way in only', () => {
    // Leaving is not the reverse of arriving: the delay exists so content
    // appears after the card opened. Applied on the way out it strands a
    // close button over a silhouette that already collapsed.
    const delayed = NOTI_CSS.split('}')
      .filter((rule) => rule.includes('var(--noti-fade-delay)'))
      .map((rule) => rule.split('{')[0] ?? '')

    expect(delayed.length).toBeGreaterThan(0)
    for (const selector of delayed) {
      expect(selector).toContain('[data-noti-visible]')
    }
  })

  it('drops the delays too under reduced motion, not only the durations', () => {
    const reduced = NOTI_CSS.split('@media (prefers-reduced-motion: reduce)')[1] ?? ''

    // Waiting 180ms to reveal a description is still motion to someone who
    // asked for none.
    expect(reduced).toContain('transition-delay: 0ms !important')
    expect(reduced).toContain('animation-delay: 0ms !important')
  })

  describe('squeezeCss', () => {
    it('drops comments and collapses whitespace', () => {
      expect(squeezeCss('/* gone */\na  {\n  color : red ;\n}\n')).toBe('a{color : red}')
    })

    it('never collapses whitespace that separates two values', () => {
      expect(squeezeCss('a{transition: width 1s ease, height 2s ease}')).toBe(
        'a{transition: width 1s ease,height 2s ease}'
      )
    })
  })
})

// @vitest-environment jsdom
//
// Compile-time contract for `modal()`. The assertions here are the type errors that
// do NOT appear: `bun run check-types` failing is this suite failing.

import React from 'react'
import { describe, expectTypeOf, it } from 'vitest'

import { createPushModal, modal, type ModalWrapperProps } from './factory'

const Root = ({ open, children }: ModalWrapperProps) => (open ? <div>{children}</div> : null)

const NoProps = () => <div>none</div>
const WithProps = ({ label, count }: { label: string; count: number }) => (
  <div>
    {label}
    {count}
  </div>
)

const { pushModal, pushModalAsync } = createPushModal({
  defaultWrapper: Root,
  modals: {
    // bare component — props inferred, no explicit generic
    NoProps: modal(NoProps),
    WithProps: modal(WithProps),

    // object form — props inferred off Component
    Wrapped: modal({ Wrapper: Root, Component: WithProps }),

    // curried form — result typed, props still inferred
    Confirm: modal<boolean>()(WithProps),
    ConfirmWrapped: modal<string>()({ Wrapper: Root, Component: NoProps }),
  },
})

describe('modal() prop inference', () => {
  it('takes no props argument for a component that declares none', () => {
    pushModal('NoProps')
  })

  it('infers props from a bare component', () => {
    pushModal('WithProps', { label: 'a', count: 1 })
  })

  it('infers props through the { Wrapper, Component } form', () => {
    pushModal('Wrapped', { label: 'a', count: 1 })
  })

  it('keeps prop inference when a result type is supplied', () => {
    pushModal('Confirm', { label: 'a', count: 1 })
    pushModal('ConfirmWrapped')
  })

  it('rejects wrong props, missing props, and unknown names', () => {
    // @ts-expect-error - count is a number
    pushModal('WithProps', { label: 'a', count: 'nope' })
    // @ts-expect-error - props are required
    pushModal('WithProps')
    // @ts-expect-error - not in the registry
    pushModal('Nope')
  })

  it('rejects a props type where a component belongs', () => {
    // The old API accepted this and only failed later, at the push site. It is now
    // rejected where the mistake is written.
    // @ts-expect-error - Record<never, never> is neither a component nor { Wrapper, Component }
    modal<Record<never, never>>(NoProps)
  })
})

describe('modal() result typing', () => {
  it('resolves the declared result type', async () => {
    expectTypeOf(pushModalAsync('Confirm', { label: 'a', count: 1 })).resolves.toEqualTypeOf<
      boolean | undefined
    >()
    expectTypeOf(pushModalAsync('ConfirmWrapped')).resolves.toEqualTypeOf<string | undefined>()
  })

  it('resolves unknown when no result type was declared', () => {
    expectTypeOf(
      pushModalAsync('WithProps', { label: 'a', count: 1 })
    ).resolves.toEqualTypeOf<unknown>()
  })
})

void React

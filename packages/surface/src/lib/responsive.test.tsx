// @vitest-environment jsdom

import React, { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createResponsiveWrapper, type ContentProps, type WrapperProps } from './responsive'

// @ts-expect-error - just a test file, we can set this global
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// createResponsiveWrapper caches the MediaQueryList on first use, so the mock has to
// be a stable object whose `matches` is a getter we can flip between renders.
let isMobile = false
const listeners = new Set<() => void>()

const mql = {
  get matches() {
    return isMobile
  },
  media: '',
  onchange: null,
  addEventListener: (_type: string, callback: () => void) => void listeners.add(callback),
  removeEventListener: (_type: string, callback: () => void) => void listeners.delete(callback),
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
} as unknown as MediaQueryList

function setViewport(mobile: boolean) {
  act(() => {
    isMobile = mobile
    listeners.forEach((callback) => callback())
  })
}

beforeEach(() => {
  isMobile = false
  listeners.clear()
  window.matchMedia = () => mql
})

afterEach(() => {
  cleanup()
})

const passthrough = (testId: string) => ({
  Wrapper: ({ open, children }: WrapperProps) => (open ? <div>{children}</div> : null),
  Content: ({ children }: ContentProps) => <div data-testid={testId}>{children}</div>,
})

function setup() {
  const { Wrapper, Content, usePreservedState, usePreservedStore } = createResponsiveWrapper({
    mobile: passthrough('mobile'),
    desktop: passthrough('desktop'),
  })

  function Field() {
    const [value, setValue] = usePreservedState('field', 'initial')

    return (
      <input data-testid='field' value={value} onChange={(event) => setValue(event.target.value)} />
    )
  }

  return { Wrapper, Content, usePreservedStore, Field }
}

describe('createResponsiveWrapper', () => {
  it('swaps between desktop and mobile renderers at the breakpoint', () => {
    const { Wrapper, Content, Field } = setup()

    render(
      <Wrapper open>
        <Content>
          <Field />
        </Content>
      </Wrapper>
    )

    expect(screen.queryByTestId('desktop')).not.toBeNull()
    expect(screen.queryByTestId('mobile')).toBeNull()

    setViewport(true)

    expect(screen.queryByTestId('mobile')).not.toBeNull()
    expect(screen.queryByTestId('desktop')).toBeNull()
  })

  it('preserves usePreservedState across the remount caused by the swap', () => {
    const { Wrapper, Content, Field } = setup()

    render(
      <Wrapper open>
        <Content>
          <Field />
        </Content>
      </Wrapper>
    )

    const field = () => screen.getByTestId('field') as HTMLInputElement

    expect(field().value).toBe('initial')
    fireEvent.change(field(), { target: { value: 'edited' } })
    expect(field().value).toBe('edited')

    setViewport(true)

    // A different component type rendered here, so Field really did remount.
    expect(screen.queryByTestId('mobile')).not.toBeNull()
    expect(field().value).toBe('edited')
  })

  it('exposes the preserved store and clears it when the wrapper closes', () => {
    const { Wrapper, Content, usePreservedStore, Field } = setup()
    let store: Map<string, unknown> | undefined

    function StoreProbe() {
      store = usePreservedStore()
      return null
    }

    const tree = (open: boolean) => (
      <Wrapper open={open}>
        <Content>
          <StoreProbe />
          <Field />
        </Content>
      </Wrapper>
    )

    const { rerender } = render(tree(true))

    fireEvent.change(screen.getByTestId('field'), { target: { value: 'edited' } })
    expect(store?.get('field')).toBe('edited')

    act(() => {
      rerender(tree(false))
    })

    expect(store?.size).toBe(0)
  })

  it('throws when Content is rendered outside of a Wrapper', () => {
    const { Content } = setup()

    expect(() => render(<Content>orphan</Content>)).toThrow(/Content must be used within a Wrapper/)
  })
})

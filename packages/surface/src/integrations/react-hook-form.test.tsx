// @vitest-environment jsdom

import React, { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createResponsiveWrapper, type ContentProps, type WrapperProps } from '../index'
import { createPreservedForm } from './react-hook-form'

// @ts-expect-error - just a test file, we can set this global
globalThis.IS_REACT_ACT_ENVIRONMENT = true

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
  const { Wrapper, Content, usePreservedStore } = createResponsiveWrapper({
    mobile: passthrough('mobile'),
    desktop: passthrough('desktop'),
  })

  const usePreservedForm = createPreservedForm(usePreservedStore)

  function Form() {
    const form = usePreservedForm<{ name: string }>('profile', {
      defaultValues: { name: 'initial' },
    })

    return (
      <>
        <input data-testid='name' {...form.register('name')} />
        <span data-testid='dirty'>{String(form.formState.isDirty)}</span>
      </>
    )
  }

  return { Wrapper, Content, Form }
}

function renderForm() {
  const { Wrapper, Content, Form } = setup()

  render(
    <Wrapper open>
      <Content>
        <Form />
      </Content>
    </Wrapper>
  )

  return {
    name: () => screen.getByTestId('name') as HTMLInputElement,
    dirty: () => screen.getByTestId('dirty').textContent,
  }
}

describe('createPreservedForm', () => {
  it('binds to the responsive store and keeps values across the swap', async () => {
    const { name } = renderForm()

    expect(name().value).toBe('initial')

    await act(async () => {
      fireEvent.change(name(), { target: { value: 'edited' } })
    })

    setViewport(true)

    expect(screen.queryByTestId('mobile')).not.toBeNull()
    expect(name().value).toBe('edited')
  })

  it('keeps isDirty measured against the original defaults after restoring', async () => {
    const { name, dirty } = renderForm()

    expect(dirty()).toBe('false')

    await act(async () => {
      fireEvent.change(name(), { target: { value: 'edited' } })
    })

    expect(dirty()).toBe('true')

    setViewport(true)

    // Restored values are not the defaults, so the form must still read as dirty
    // even though useForm was re-initialised with them.
    expect(name().value).toBe('edited')
    expect(dirty()).toBe('true')
  })

  it('reports a clean form when the restored values match the defaults', async () => {
    const { name, dirty } = renderForm()

    await act(async () => {
      fireEvent.change(name(), { target: { value: 'edited' } })
      fireEvent.change(name(), { target: { value: 'initial' } })
    })

    setViewport(true)

    expect(name().value).toBe('initial')
    expect(dirty()).toBe('false')
  })
})

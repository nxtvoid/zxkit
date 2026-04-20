// @vitest-environment jsdom

import React, { act } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { createPushModal, modal, useModalControls } from './factory'

// @ts-expect-error - just a test file, we can set this global
globalThis.IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  cleanup()
})

function createTestModalSystem() {
  return createPushModal({
    modals: {
      example: modal({
        Wrapper: ({ open, onOpenChange, children }) =>
          open ? (
            <div data-testid='modal-root'>
              <button type='button' onClick={() => onOpenChange?.(false)}>
                close
              </button>
              {children}
            </div>
          ) : null,
        Component: ({ label }) => <div>{label}</div>,
      }),
      confirm: modal<{ label: string }, boolean>({
        Wrapper: ({ open, onOpenChange, children }) =>
          open ? (
            <div data-testid='modal-root'>
              <button type='button' onClick={() => onOpenChange?.(false)}>
                close
              </button>
              {children}
            </div>
          ) : null,
        Component: ({ label }) => {
          const { resolve, reject } = useModalControls<boolean>()

          return (
            <div>
              <div>{label}</div>
              <button type='button' onClick={() => resolve(true)}>
                confirm
              </button>
              <button type='button' onClick={() => reject(new Error('cancelled'))}>
                reject
              </button>
            </div>
          )
        },
      }),
      stepOne: modal<{ label: string }>({
        Wrapper: ({ open, onOpenChange, children }) =>
          open ? (
            <div data-testid='modal-root'>
              <button type='button' onClick={() => onOpenChange?.(false)}>
                close
              </button>
              {children}
            </div>
          ) : null,
        Component: ({ label }) => {
          const { replace } = useModalControls()

          return (
            <div>
              <div>{label}</div>
              <button type='button' onClick={() => replace('stepTwo', { label: 'second step' })}>
                next
              </button>
            </div>
          )
        },
      }),
      stepTwo: modal<{ label: string }>({
        Wrapper: ({ open, onOpenChange, children }) =>
          open ? (
            <div data-testid='modal-root'>
              <button type='button' onClick={() => onOpenChange?.(false)}>
                close
              </button>
              {children}
            </div>
          ) : null,
        Component: ({ label }) => <div>{label}</div>,
      }),
    },
  })
}

describe('createPushModal', () => {
  it('closes the specific modal instance when two modals share the same name', () => {
    const { ModalProvider, pushModal } = createTestModalSystem()

    render(<ModalProvider />)

    act(() => {
      pushModal('example', { label: 'first' })
      pushModal('example', { label: 'second' })
    })

    const firstModal = screen.getByText('first').closest('[data-testid="modal-root"]')
    expect(firstModal).not.toBeNull()

    fireEvent.click(within(firstModal as HTMLElement).getByRole('button', { name: 'close' }))

    expect(screen.queryByText('first')).toBeNull()
    expect(screen.queryByText('second')).not.toBeNull()
  })

  it('popModal(name) still closes the last opened modal for that name', () => {
    const { ModalProvider, pushModal, popModal } = createTestModalSystem()

    render(<ModalProvider />)

    act(() => {
      pushModal('example', { label: 'first' })
      pushModal('example', { label: 'second' })
    })

    act(() => {
      popModal('example')
    })

    expect(screen.queryByText('first')).not.toBeNull()
    expect(screen.queryByText('second')).toBeNull()
  })

  it('popAllModals closes every open modal instance', () => {
    const { ModalProvider, pushModal, popAllModals } = createTestModalSystem()

    render(<ModalProvider />)

    act(() => {
      pushModal('example', { label: 'first' })
      pushModal('example', { label: 'second' })
    })

    act(() => {
      popAllModals()
    })

    expect(screen.queryByText('first')).toBeNull()
    expect(screen.queryByText('second')).toBeNull()
  })

  it('pushModalAsync resolves with the value provided by the modal', async () => {
    const { ModalProvider, pushModalAsync } = createTestModalSystem()

    render(<ModalProvider />)

    let resultPromise: Promise<boolean | undefined> | undefined

    act(() => {
      resultPromise = pushModalAsync('confirm', { label: 'confirm me' })
    })

    expect(screen.queryByText('confirm me')).not.toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'confirm' }))
    })

    await expect(resultPromise).resolves.toBe(true)
  })

  it('pushModalAsync resolves undefined when the modal is dismissed', async () => {
    const { ModalProvider, pushModalAsync } = createTestModalSystem()

    render(<ModalProvider />)

    let resultPromise: Promise<boolean | undefined> | undefined

    act(() => {
      resultPromise = pushModalAsync('confirm', { label: 'dismiss me' })
    })

    expect(screen.queryByText('dismiss me')).not.toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'close' }))
    })

    await expect(resultPromise).resolves.toBeUndefined()
  })

  it('returns a handle that can replace a specific modal instance', () => {
    const { ModalProvider, pushModal } = createTestModalSystem()

    render(<ModalProvider />)

    let firstHandle: ReturnType<typeof pushModal> | undefined

    act(() => {
      firstHandle = pushModal('example', { label: 'first' })
      pushModal('example', { label: 'second' })
    })

    act(() => {
      firstHandle?.replace('stepTwo', { label: 'replacement' })
    })

    expect(screen.queryByText('first')).toBeNull()
    expect(screen.queryByText('replacement')).not.toBeNull()
    expect(screen.queryByText('second')).not.toBeNull()
  })

  it('allows a modal to replace itself through useModalControls', () => {
    const { ModalProvider, pushModal } = createTestModalSystem()

    render(<ModalProvider />)

    act(() => {
      pushModal('stepOne', { label: 'first step' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'next' }))

    expect(screen.queryByText('first step')).toBeNull()
    expect(screen.queryByText('second step')).not.toBeNull()
  })
})

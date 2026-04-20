// @vitest-environment jsdom

import { act } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { createPushModal } from './factory'

// @ts-expect-error - just a test file, we can set this global
globalThis.IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  cleanup()
})

type ModalMap = {
  example: { label: string }
}

function createTestModalSystem() {
  return createPushModal<ModalMap>({
    modals: {
      example: {
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
      },
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
})

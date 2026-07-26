// @vitest-environment jsdom

import React, { act } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
      confirm: modal<boolean>()({
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
      stepOne: modal({
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
      stepTwo: modal({
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

describe('createPushModal defaultWrapper', () => {
  const bareModals = {
    bare: modal(({ label }: { label: string }) => <div>{label}</div>),
  }

  it('hosts modals that declare no Wrapper of their own', () => {
    const { ModalProvider, pushModal } = createPushModal({
      modals: bareModals,
      defaultWrapper: ({ open, onOpenChange, children }) =>
        open ? (
          <div data-testid='default-root'>
            <button type='button' onClick={() => onOpenChange?.(false)}>
              close
            </button>
            {children}
          </div>
        ) : null,
    })

    render(<ModalProvider />)

    act(() => {
      pushModal('bare', { label: 'from default wrapper' })
    })

    const root = screen.getByTestId('default-root')
    expect(within(root).queryByText('from default wrapper')).not.toBeNull()

    fireEvent.click(within(root).getByRole('button', { name: 'close' }))

    expect(screen.queryByText('from default wrapper')).toBeNull()
  })

  it('lets a per-modal Wrapper take precedence over the defaultWrapper', () => {
    const { ModalProvider, pushModal } = createPushModal({
      modals: {
        own: modal({
          Wrapper: ({ open, children }) =>
            open ? <div data-testid='own-root'>{children}</div> : null,
          Component: ({ label }) => <div>{label}</div>,
        }),
      },
      defaultWrapper: ({ open, children }) =>
        open ? <div data-testid='default-root'>{children}</div> : null,
    })

    render(<ModalProvider />)

    act(() => {
      pushModal('own', { label: 'own wrapper' })
    })

    expect(screen.queryByTestId('own-root')).not.toBeNull()
    expect(screen.queryByTestId('default-root')).toBeNull()
  })

  // The package ships no primitive of its own, so this is the only failure mode
  // A pushed modal does not exist until it is pushed, so the wrapper would otherwise
  // mount with `open` already true. Primitives that read their enter animation off the
  // open transition — Base UI seeds its `mounted` state with `open` — then apply no
  // starting styles, and the panel appears with no entrance while the exit still
  // animates. These tests pin the transition the wrapper is handed.
  describe('open transition', () => {
    function trackOpen(modals: Parameters<typeof createPushModal>[0]['modals']) {
      const seen: (boolean | undefined)[] = []
      const system = createPushModal({
        defaultWrapper: ({ open, onOpenChange, children }) => {
          seen.push(open)
          return open ? (
            <div data-testid='modal-root'>
              <button type='button' onClick={() => onOpenChange?.(false)}>
                close
              </button>
              {children}
            </div>
          ) : null
        },
        modals,
      })
      return { seen, ...system }
    }

    it('hands the wrapper a closed render before opening it', () => {
      const { seen, ModalProvider, pushModal } = trackOpen({
        example: modal(({ label }: { label: string }) => <div>{label}</div>),
      })
      render(<ModalProvider />)

      act(() => {
        pushModal('example', { label: 'first' })
      })

      expect(seen[0]).toBe(false)
      expect(seen).toContain(true)
      // Still mounted synchronously — the flip is a layout effect, not a frame.
      expect(screen.queryByText('first')).not.toBeNull()
    })

    it('closes without an extra open render, so the exit still animates', () => {
      const { seen, ModalProvider, pushModal } = trackOpen({
        example: modal(({ label }: { label: string }) => <div>{label}</div>),
      })
      render(<ModalProvider />)

      act(() => {
        pushModal('example', { label: 'first' })
      })
      seen.length = 0

      fireEvent.click(screen.getByRole('button', { name: 'close' }))

      expect(seen).toContain(false)
      expect(seen).not.toContain(true)
    })

    it('does not reopen the wrapper when the modal is replaced', () => {
      const { seen, ModalProvider, pushModal, replaceWithModal } = trackOpen({
        example: modal(({ label }: { label: string }) => <div>{label}</div>),
        other: modal(() => <div>other</div>),
      })
      render(<ModalProvider />)

      act(() => {
        pushModal('example', { label: 'first' })
      })
      seen.length = 0

      act(() => {
        replaceWithModal('other')
      })

      // A replace keeps the same slot open. Dropping back to false here would blink
      // the wrapper shut and replay its entrance.
      expect(seen).not.toContain(false)
      expect(screen.queryByText('other')).not.toBeNull()
    })
  })

  // An unregistered name used to reach the internal registry lookup and surface as
  // "Cannot use 'in' operator to search for '__flow' in undefined", which says nothing
  // about what the caller did wrong.
  describe('unregistered modal names', () => {
    const system = () =>
      createPushModal({
        defaultWrapper: ({ open, children }) => (open ? <div>{children}</div> : null),
        modals: {
          AppMenuSheet: modal(() => <div>menu</div>),
          TestModal: modal(() => <div>test</div>),
        },
      })

    const expectNamedError = (run: () => unknown) => {
      expect(run).toThrow(/Modal "TestSheet" is not registered with createPushModal/)
      // TestModal first: it shares the "Test" stem with the name that missed.
      expect(run).toThrow(/Known modals, closest first: TestModal, AppMenuSheet\./)
    }

    it('names the modal and lists the registered ones on push', () => {
      const { pushModal } = system()
      // @ts-expect-error - the point of the test is the runtime message
      expectNamedError(() => pushModal('TestSheet'))
    })

    it('does the same for pushModalAsync and replaceWithModal', () => {
      const { pushModalAsync, replaceWithModal } = system()
      // @ts-expect-error - unregistered on purpose
      expectNamedError(() => pushModalAsync('TestSheet'))
      // @ts-expect-error - unregistered on purpose
      expectNamedError(() => replaceWithModal('TestSheet'))
    })

    it('does the same for a handle replace', () => {
      const { ModalProvider, pushModal } = system()
      render(<ModalProvider />)

      let handle: ReturnType<typeof pushModal>
      act(() => {
        handle = pushModal('TestModal')
      })

      // @ts-expect-error - unregistered on purpose
      expectNamedError(() => handle.replace('TestSheet'))
    })

    // This one has no type safety at all: useModalControls cannot know the registry,
    // so a typo here compiles cleanly and only the runtime check catches it.
    it('does the same for useModalControls().replace, which is untyped', () => {
      let replaceFromInside: (name: string) => void = () => {}

      const { ModalProvider, pushModal } = createPushModal({
        defaultWrapper: ({ open, children }) => (open ? <div>{children}</div> : null),
        modals: {
          AppMenuSheet: modal(() => <div>menu</div>),
          TestModal: modal(() => {
            const { replace } = useModalControls()
            replaceFromInside = replace
            return <div>test</div>
          }),
        },
      })
      render(<ModalProvider />)

      act(() => {
        pushModal('TestModal')
      })

      expectNamedError(() => replaceFromInside('TestSheet'))
    })

    it('caps a large registry and counts the rest', () => {
      const many = Object.fromEntries(
        Array.from({ length: 200 }, (_, i) => [`Modal${i}`, modal(() => <div>x</div>)])
      )
      const { pushModal } = createPushModal({ modals: many })
      const push = pushModal as unknown as (name: string) => void

      let message = ''
      try {
        push('Nope')
      } catch (error) {
        message = (error as Error).message
      }

      // Eight names and a count, not a wall of two hundred.
      const listed = message.slice(message.indexOf('closest first: ')).split(', ')
      expect(listed).toHaveLength(9)
      expect(message).toContain('+192 more.')
    })

    it('puts the closest name first, including a casing-only mistake', () => {
      const { pushModal } = createPushModal({
        modals: {
          AppMenuSheet: modal(() => <div>a</div>),
          TestModal: modal(() => <div>b</div>),
        },
      })
      const push = pushModal as unknown as (name: string) => void

      expect(() => push('testmodal')).toThrow(/closest first: TestModal, AppMenuSheet\./)
    })

    it('says so plainly when the registry is empty', () => {
      const { pushModal } = createPushModal({ modals: {} })
      // With no entries the name type degenerates to `never`, so call through a cast
      // rather than assert on an arity error that says nothing about the behaviour.
      const push = pushModal as unknown as (name: string) => void

      expect(() => push('Anything')).toThrow(
        /The modals object passed to createPushModal is empty\./
      )
    })
  })

  // left when a consumer forgets to supply one.
  it('throws a directive error when neither a Wrapper nor a defaultWrapper exists', () => {
    const { ModalProvider, pushModal } = createPushModal({ modals: bareModals })

    // React logs the render error to console.error before it propagates.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      render(<ModalProvider />)

      expect(() =>
        act(() => {
          pushModal('bare', { label: 'no wrapper' })
        })
      ).toThrow(/declares no Wrapper.*without a defaultWrapper/s)
    } finally {
      consoleError.mockRestore()
    }
  })
})

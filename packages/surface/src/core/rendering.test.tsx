// @vitest-environment jsdom

import React, { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { createPushModal, modal, useModalControls, type ModalWrapperProps } from '../index'

// @ts-expect-error - just a test file, we can set this global
globalThis.IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  cleanup()
})

const Wrapper = ({ open, onOpenChange, children }: ModalWrapperProps) =>
  open ? (
    <div>
      <button type='button' onClick={() => onOpenChange?.(false)}>
        dismiss
      </button>
      {children}
    </div>
  ) : null

// The provider re-renders on every stack change. Without memoisation each open modal
// re-renders with it, so a stack of ten costs ten renders per push.
describe('rendering cost', () => {
  function trackRenders() {
    const renders = { a: 0, b: 0 }

    const A = () => {
      renders.a += 1
      useModalControls()
      return <div>a</div>
    }
    const B = () => {
      renders.b += 1
      return <div>b</div>
    }

    const system = createPushModal({
      defaultWrapper: Wrapper,
      modals: { A: modal(A), B: modal(B), C: modal(() => <div>c</div>) },
    })

    return { renders, ...system }
  }

  it('does not re-render an open modal when another is pushed', () => {
    const { renders, ModalProvider, pushModal } = trackRenders()
    render(<ModalProvider />)

    act(() => {
      pushModal('A')
    })
    const afterOpen = renders.a

    act(() => {
      pushModal('B')
    })

    expect(renders.a).toBe(afterOpen)
  })

  it('does not re-render open modals when another is popped', () => {
    const { renders, ModalProvider, pushModal, popModal } = trackRenders()
    render(<ModalProvider />)

    act(() => {
      pushModal('A')
      pushModal('B')
    })
    const afterOpen = renders.a

    act(() => {
      popModal('B')
    })

    expect(renders.a).toBe(afterOpen)
  })

  it('renders each modal once per push regardless of stack depth', () => {
    let total = 0
    const Counted = () => {
      total += 1
      return <div>x</div>
    }

    const { ModalProvider, pushModal } = createPushModal({
      defaultWrapper: Wrapper,
      modals: { X: modal(Counted) },
    })
    render(<ModalProvider />)

    const depth = 10
    act(() => {
      for (let i = 0; i < depth; i += 1) {
        pushModal('X')
      }
    })

    // Linear, not quadratic: without memoisation this is depth * (depth + 1) / 2.
    expect(total).toBe(depth)
  })

  it('still re-renders the modal whose own state changed', () => {
    let renders = 0
    const Stateful = ({ label }: { label: string }) => {
      renders += 1
      return <div>{label}</div>
    }

    const { ModalProvider, pushModal, replaceWithModal } = createPushModal({
      defaultWrapper: Wrapper,
      modals: { A: modal(Stateful), B: modal(() => <div>b</div>) },
    })
    render(<ModalProvider />)

    act(() => {
      pushModal('A', { label: 'first' })
    })
    const afterOpen = renders

    act(() => {
      replaceWithModal('A', { label: 'second' })
    })

    expect(renders).toBeGreaterThan(afterOpen)
    expect(screen.queryByText('second')).not.toBeNull()
  })

  it('keeps the wrapper mounted across a push, so its entered state survives', () => {
    // Only A's wrapper is tracked. B mounts its own, which does go false -> true.
    const opens: (boolean | undefined)[] = []
    const TrackedWrapper = ({ open, children }: ModalWrapperProps) => {
      opens.push(open)
      return open ? <div>{children}</div> : null
    }

    const { ModalProvider, pushModal } = createPushModal({
      defaultWrapper: Wrapper,
      modals: {
        A: modal({ Wrapper: TrackedWrapper, Component: () => <div>a</div> }),
        B: modal(() => <div>b</div>),
      },
    })
    render(<ModalProvider />)

    act(() => {
      pushModal('A')
    })
    opens.length = 0

    act(() => {
      pushModal('B')
    })

    // A's wrapper must not drop back to closed and replay its entrance.
    expect(opens).not.toContain(false)
  })

  it('does not resubscribe useOnPushModal when the callback identity changes', () => {
    let calls = 0
    const { ModalProvider, useOnPushModal, pushModal } = createPushModal({
      defaultWrapper: Wrapper,
      modals: { A: modal(() => <div>a</div>) },
    })

    const Consumer = ({ tick }: { tick: number }) => {
      useOnPushModal('A', () => {
        calls += 1
      })
      return <div>{tick}</div>
    }

    const tree = (tick: number) => (
      <>
        <ModalProvider />
        <Consumer tick={tick} />
      </>
    )

    const { rerender } = render(tree(0))
    for (let i = 1; i <= 5; i += 1) {
      rerender(tree(i))
    }

    act(() => {
      pushModal('A')
    })

    // One subscription, so one call — not one per render of the consumer.
    expect(calls).toBe(1)
  })

  it('still delivers the latest callback after a rerender', () => {
    const seen: number[] = []
    const { ModalProvider, useOnPushModal, pushModal } = createPushModal({
      defaultWrapper: Wrapper,
      modals: { A: modal(() => <div>a</div>) },
    })

    const Consumer = ({ tick }: { tick: number }) => {
      useOnPushModal('A', () => {
        seen.push(tick)
      })
      return <div>{tick}</div>
    }

    const tree = (tick: number) => (
      <>
        <ModalProvider />
        <Consumer tick={tick} />
      </>
    )

    const { rerender } = render(tree(1))
    rerender(tree(2))

    act(() => {
      pushModal('A')
    })

    expect(seen).toEqual([2])
  })

  it('cleans up its subscription on unmount', () => {
    let calls = 0
    const { ModalProvider, useOnPushModal, pushModal } = createPushModal({
      defaultWrapper: Wrapper,
      modals: { A: modal(() => <div>a</div>) },
    })

    const Consumer = () => {
      useOnPushModal('A', () => {
        calls += 1
      })
      return null
    }

    const { rerender } = render(
      <>
        <ModalProvider />
        <Consumer />
      </>
    )
    rerender(<ModalProvider />)

    act(() => {
      pushModal('A')
    })

    expect(calls).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }))
  })
})

// @vitest-environment jsdom

import React, { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  createPushModal,
  flow,
  modal,
  useFlowControls,
  useModalControls,
  type FlowContentProps,
  type ModalWrapperProps,
} from '../index'

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

// The shell whose survival is the whole point of a flow.
const Shell = ({ children }: FlowContentProps) => <div data-testid='shell'>{children}</div>

const CartStep = ({ label }: { label: string }) => {
  const { go, back, canGoBack } = useFlowControls<typeof steps>()

  return (
    <div>
      <span>cart: {label}</span>
      <span data-testid='can-go-back'>{String(canGoBack)}</span>
      <button type='button' onClick={back}>
        back
      </button>
      <button type='button' onClick={() => go('payment', { amount: 42 })}>
        to payment
      </button>
    </div>
  )
}

const PaymentStep = ({ amount }: { amount: number }) => {
  const { go, back, canGoBack, step } = useFlowControls<typeof steps>()
  const { resolve } = useModalControls<boolean>()

  return (
    <div>
      <span>payment: {amount}</span>
      <span data-testid='step'>{step}</span>
      <span data-testid='can-go-back'>{String(canGoBack)}</span>
      <button type='button' onClick={back}>
        back
      </button>
      <button type='button' onClick={() => go('done')}>
        to done
      </button>
      <button type='button' onClick={() => resolve(true)}>
        finish
      </button>
    </div>
  )
}

const DoneStep = () => {
  const { reset, replaceStep } = useFlowControls<typeof steps>()

  return (
    <div>
      <span>done</span>
      <button type='button' onClick={reset}>
        restart
      </button>
      <button type='button' onClick={() => replaceStep('cart', { label: 'again' })}>
        replace with cart
      </button>
    </div>
  )
}

const steps = { cart: CartStep, payment: PaymentStep, done: DoneStep }

const OtherStep = () => <div>other</div>
const TitledStep = ({ title }: { title: string }) => <div>title: {title}</div>

function setup() {
  return createPushModal({
    modals: {
      Checkout: flow<boolean>()({ Wrapper, Content: Shell, initial: 'cart', steps }),

      // no step names in common, to catch step state leaking across a replace
      Other: flow({ Wrapper, Content: Shell, initial: 'other', steps: { other: OtherStep } }),
      Titled: flow({ Wrapper, Content: Shell, initial: 'titled', steps: { titled: TitledStep } }),

      // two plain modals, to contrast replace() against stepping
      First: modal({ Wrapper, Component: () => <div data-testid='shell'>first</div> }),
      Second: modal({ Wrapper, Component: () => <div data-testid='shell'>second</div> }),
    },
  })
}

describe('flow', () => {
  it('keeps the shell mounted across steps', () => {
    const { ModalProvider, pushModal } = setup()
    render(<ModalProvider />)

    act(() => {
      pushModal('Checkout', { label: 'one item' })
    })

    const shellBefore = screen.getByTestId('shell')
    expect(screen.queryByText('cart: one item')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'to payment' }))

    expect(screen.queryByText('payment: 42')).not.toBeNull()
    // Same DOM node: React reconciled the shell instead of tearing it down.
    expect(screen.getByTestId('shell')).toBe(shellBefore)
  })

  it('replacing one modal with another does remount the shell', () => {
    const { ModalProvider, pushModal, replaceWithModal } = setup()
    render(<ModalProvider />)

    act(() => {
      pushModal('First')
    })

    const shellBefore = screen.getByTestId('shell')

    act(() => {
      replaceWithModal('Second')
    })

    expect(screen.queryByText('second')).not.toBeNull()
    // The contrast that makes the assertion above meaningful.
    expect(screen.getByTestId('shell')).not.toBe(shellBefore)
  })

  it('passes props to the initial step and to each step it moves to', () => {
    const { ModalProvider, pushModal } = setup()
    render(<ModalProvider />)

    act(() => {
      pushModal('Checkout', { label: 'one item' })
    })

    expect(screen.queryByText('cart: one item')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'to payment' }))
    expect(screen.queryByText('payment: 42')).not.toBeNull()
    expect(screen.getByTestId('step').textContent).toBe('payment')
  })

  it('goes back to the previous step and reports canGoBack', () => {
    const { ModalProvider, pushModal } = setup()
    render(<ModalProvider />)

    act(() => {
      pushModal('Checkout', { label: 'one item' })
    })

    expect(screen.getByTestId('can-go-back').textContent).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'to payment' }))
    expect(screen.getByTestId('can-go-back').textContent).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    expect(screen.queryByText('cart: one item')).not.toBeNull()
    expect(screen.getByTestId('can-go-back').textContent).toBe('false')
  })

  it('replaceStep() drops the current step so back() skips it', () => {
    const { ModalProvider, pushModal } = setup()
    render(<ModalProvider />)

    act(() => {
      pushModal('Checkout', { label: 'one item' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'to payment' }))
    fireEvent.click(screen.getByRole('button', { name: 'to done' }))
    fireEvent.click(screen.getByRole('button', { name: 'replace with cart' }))

    // done was swapped out, so going back lands on payment, not done
    expect(screen.queryByText('cart: again')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    expect(screen.queryByText('payment: 42')).not.toBeNull()
  })

  it('reset() returns to the initial step with its original props', () => {
    const { ModalProvider, pushModal } = setup()
    render(<ModalProvider />)

    act(() => {
      pushModal('Checkout', { label: 'one item' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'to payment' }))
    fireEvent.click(screen.getByRole('button', { name: 'to done' }))
    fireEvent.click(screen.getByRole('button', { name: 'restart' }))

    expect(screen.queryByText('cart: one item')).not.toBeNull()
    expect(screen.getByTestId('can-go-back').textContent).toBe('false')
  })

  it('resolves the flow result from inside a step', async () => {
    const { ModalProvider, pushModalAsync } = setup()
    render(<ModalProvider />)

    let result: Promise<boolean | undefined> | undefined

    act(() => {
      result = pushModalAsync('Checkout', { label: 'one item' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'to payment' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'finish' }))
    })

    await expect(result).resolves.toBe(true)
  })

  it('resolves undefined when the flow is dismissed mid-way', async () => {
    const { ModalProvider, pushModalAsync } = setup()
    render(<ModalProvider />)

    let result: Promise<boolean | undefined> | undefined

    act(() => {
      result = pushModalAsync('Checkout', { label: 'one item' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'to payment' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'dismiss' }))
    })

    await expect(result).resolves.toBeUndefined()
  })

  it('restarts when the slot is replaced by a different flow', () => {
    const { ModalProvider, pushModal, replaceWithModal } = setup()
    render(<ModalProvider />)

    act(() => {
      pushModal('Checkout', { label: 'one item' })
    })
    fireEvent.click(screen.getByRole('button', { name: 'to payment' }))

    // Without a fresh body the incoming flow inherits the outgoing one's step stack.
    act(() => {
      replaceWithModal('Other')
    })

    expect(screen.queryByText('other')).not.toBeNull()
  })

  it('restarts when replaced by the same flow with new props', () => {
    const { ModalProvider, pushModal, replaceWithModal } = setup()
    render(<ModalProvider />)

    act(() => {
      pushModal('Titled', { title: 'first' })
    })
    expect(screen.queryByText('title: first')).not.toBeNull()

    act(() => {
      replaceWithModal('Titled', { title: 'second' })
    })

    expect(screen.queryByText('title: second')).not.toBeNull()
  })

  it('falls back to defaultWrapper when the flow declares no Wrapper', () => {
    const { ModalProvider, pushModal } = createPushModal({
      defaultWrapper: Wrapper,
      modals: {
        Bare: flow({ Content: Shell, initial: 'other', steps: { other: OtherStep } }),
      },
    })
    render(<ModalProvider />)

    act(() => {
      pushModal('Bare')
    })

    expect(screen.queryByText('other')).not.toBeNull()
  })

  it('throws when a flow has no Wrapper and there is no defaultWrapper', () => {
    const { ModalProvider, pushModal } = createPushModal({
      modals: {
        Bare: flow({ Content: Shell, initial: 'other', steps: { other: OtherStep } }),
      },
    })
    render(<ModalProvider />)

    expect(() =>
      act(() => {
        pushModal('Bare')
      })
    ).toThrow(/declares no Wrapper/)
  })

  it('throws when useFlowControls is used outside a flow', () => {
    const Orphan = () => {
      useFlowControls()
      return null
    }

    expect(() => render(<Orphan />)).toThrow(/useFlowControls must be used within a step/)
  })
})

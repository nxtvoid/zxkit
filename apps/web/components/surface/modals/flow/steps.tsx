import { Button } from '@zxkit/ui/button'
import { DialogDescription, DialogHeader, DialogTitle } from '@zxkit/ui/dialog'
import { useFlowControls, useModalControls } from '@zxkit/surface'

// Steps render only the body. The Dialog/Drawer shell is rendered once by the flow
// and stays mounted, which is what keeps the panel from replaying its entrance.

const PlanStep = ({ plan }: { plan: string }) => {
  const { go } = useFlowControls<typeof flowSteps>()
  const { close } = useModalControls()

  return (
    <>
      <DialogHeader>
        <DialogTitle>Choose a plan</DialogTitle>
        <DialogDescription>Step one of three. The shell never unmounts.</DialogDescription>
      </DialogHeader>

      <div className='text-muted-foreground mt-4 space-y-4 text-sm'>
        <p>
          Currently on <code className='text-foreground/80'>{plan}</code>. Moving forward swaps only
          this body — watch the panel, it does not flash.
        </p>

        <div className='flex flex-col gap-2 sm:flex-row'>
          <Button onClick={() => go('payment', { amount: 24 })}>Continue</Button>
          <Button variant='ghost' onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  )
}

const PaymentStep = ({ amount }: { amount: number }) => {
  const { go, back } = useFlowControls<typeof flowSteps>()

  return (
    <>
      <DialogHeader>
        <DialogTitle>Confirm payment</DialogTitle>
        <DialogDescription>Step two of three. Going back is free.</DialogDescription>
      </DialogHeader>

      <div className='text-muted-foreground mt-4 space-y-4 text-sm'>
        <p>
          You will be charged <span className='text-foreground/80'>${amount}</span>.
        </p>

        <div className='flex flex-col gap-2 sm:flex-row'>
          <Button onClick={() => go('done')}>Pay</Button>
          <Button variant='ghost' onClick={back}>
            Back
          </Button>
        </div>
      </div>
    </>
  )
}

const DoneStep = () => {
  const { reset } = useFlowControls<typeof flowSteps>()
  const { resolve } = useModalControls<boolean>()

  return (
    <>
      <DialogHeader>
        <DialogTitle>All set</DialogTitle>
        <DialogDescription>Step three of three.</DialogDescription>
      </DialogHeader>

      <div className='text-muted-foreground mt-4 space-y-4 text-sm'>
        <p>The three steps shared one Dialog. No close, no reopen, no flash.</p>

        <div className='flex flex-col gap-2 sm:flex-row'>
          <Button onClick={() => resolve(true)}>Done</Button>
          <Button variant='ghost' onClick={reset}>
            Start over
          </Button>
        </div>
      </div>
    </>
  )
}

const flowSteps = {
  plan: PlanStep,
  payment: PaymentStep,
  done: DoneStep,
}

export { flowSteps }

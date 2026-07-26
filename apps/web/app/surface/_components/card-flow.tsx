'use client'

import { Button } from '@zxkit/ui/button'
import { pushModal } from '@/components/surface/modals'
import { SurfaceExampleCard } from '@/components/surface/example-card'

const CardFlowExample = () => {
  return (
    <SurfaceExampleCard
      header={{
        title: 'Flow',
        subtitle: 'Multi-step in one shell. Compare the two — replace flashes, flow does not.',
        badgeText: 'flow',
      }}
      classes={{
        tabCode: 'justify-baseline items-baseline',
      }}
      content={{
        preview: (
          <div className='flex flex-col items-center gap-4'>
            <div className='flex flex-wrap items-center justify-center gap-3'>
              <Button onClick={() => pushModal('CheckoutFlow', { plan: 'pro' })}>
                Flow (3 steps)
              </Button>
              <Button variant='outline' onClick={() => pushModal('ReplaceStartExample')}>
                Replace
              </Button>
            </div>
            <p className='text-muted-foreground max-w-sm text-center text-xs leading-5'>
              Watch the panel, not the content. Replace tears the panel down and mounts a new one,
              so it replays its open animation. A flow keeps the same panel and swaps only the body.
            </p>
          </div>
        ),
        code: (
          <pre className='bg-muted size-full flex-1 grow overflow-x-auto rounded-md p-4'>
            {`// flow/steps.tsx — steps render only the body, no Content
const PlanStep = ({ plan }: { plan: string }) => {
  const { go } = useFlowControls<typeof flowSteps>()
  return <Button onClick={() => go('payment', { amount: 24 })}>Continue</Button>
}

export const flowSteps = { plan: PlanStep, payment: PaymentStep, done: DoneStep }

// modals/index.ts — the flow owns the shell
CheckoutFlow: flow<boolean>()({
  Content: DynamicContent,   // mounted once, never unmounts
  initial: 'plan',           // also decides the flow's own props
  steps: flowSteps,
}),                          // no Wrapper -> uses defaultWrapper

// anywhere
pushModal('CheckoutFlow', { plan: 'pro' })   // props of the initial step
const paid = await pushModalAsync('CheckoutFlow', { plan: 'pro' })
`}
          </pre>
        ),
      }}
    />
  )
}

export { CardFlowExample }

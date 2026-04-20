'use client'

import { Button } from '@zxkit/ui/button'
import { pushModal } from '@/components/surface/modals'
import { SurfaceExampleCard } from '@/components/surface/example-card'

const CardReplaceExample = () => {
  return (
    <SurfaceExampleCard
      header={{
        title: 'Replace',
        subtitle: 'Swap the current modal for the next step in the same flow.',
        badgeText: 'Flow API',
      }}
      classes={{
        tabCode: 'justify-baseline items-baseline',
      }}
      content={{
        preview: <Button onClick={() => pushModal('ReplaceStartExample')}>Open Flow Modal</Button>,
        code: (
          <pre className='bg-muted size-full flex-1 grow overflow-x-auto rounded-md p-4'>
            {`const flow = pushModal('ReplaceStartExample')

flow.replace('ReplaceSuccessExample', {
  title: 'Release ready',
  description: 'The first modal was replaced in place.'
})

const ReplaceStartExample = () => {
  const { replace } = useModalControls()

  return (
    <button
      onClick={() =>
        replace('ReplaceSuccessExample', {
          title: 'Release ready'
        })
      }
    >
      Continue
    </button>
  )
}
`}
          </pre>
        ),
      }}
    />
  )
}

export { CardReplaceExample }

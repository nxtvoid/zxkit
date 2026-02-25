'use client'

import { Button } from '@zxkit/ui/button'
import { pushModal } from '@/components/surface/modals'
import { SurfaceExampleCard } from '@/components/surface/example-card'

const CardDynamicExample = () => {
  return (
    <SurfaceExampleCard
      header={{
        title: 'Dynamic',
        subtitle: 'Dialog on desktop, Drawer on mobile.',
        badgeText: 'Responsive',
      }}
      classes={{
        tabCode: 'justify-baseline items-baseline',
      }}
      content={{
        preview: <Button onClick={() => pushModal('DynamicExample')}>Open Dialog / Drawer</Button>,
        code: (
          <pre className='bg-muted size-full flex-1 grow overflow-x-auto rounded-md p-4'>
            {`import { DialogDescription, DialogHeader, DialogTitle } from '@zxkit/ui/dialog'
import { DynamicWrapper } from '../dynamic'

const DynamicModalExample = () => {
  return (
    <DynamicWrapper.Content>
      <DialogHeader>
        <DialogTitle>Dynamic Modal Example</DialogTitle>
        <DialogDescription>
          This modal is rendered dynamically when you push it using the pushModal function.
        </DialogDescription>
      </DialogHeader>
      <div className='text-muted-foreground mt-4 min-h-80 text-sm'>
        Drawer in mobile and dialog on desktop 🤘
      </div>
    </DynamicWrapper.Content>
  )
}

export { DynamicModalExample }
`}
          </pre>
        ),
      }}
    />
  )
}

export { CardDynamicExample }

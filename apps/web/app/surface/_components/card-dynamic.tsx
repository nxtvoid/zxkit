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
        <DialogTitle>Responsive modal</DialogTitle>
        <DialogDescription>
          Dialog on desktop, drawer on mobile — the same component.
        </DialogDescription>
      </DialogHeader>
      <div className='text-muted-foreground mt-4 min-h-80 text-sm'>
        Resize the window with this open. Below the breakpoint it re-renders
        as a drawer without losing its place in the stack.
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

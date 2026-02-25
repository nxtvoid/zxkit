'use client'

import { Button } from '@zxkit/ui/button'
import { pushModal } from '@/components/surface/modals'
import { SurfaceExampleCard } from '@/components/surface/example-card'

const CardDefaultExample = () => {
  return (
    <SurfaceExampleCard
      header={{
        title: 'Default',
        subtitle: 'Dialog only, no responsive wrapper.',
        badgeText: 'Basic',
      }}
      content={{
        preview: <Button onClick={() => pushModal('DefaultExample')}>Open Dialog</Button>,
        code: (
          <pre className='bg-muted overflow-x-auto rounded-md p-4'>
            {`import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@zxkit/ui/dialog'

const DefaultModalExample = () => {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Default Modal Example</DialogTitle>
        <DialogDescription>
          This modal is rendered dynamically when you push it using the pushModal function.
        </DialogDescription>
      </DialogHeader>
      <div className='text-muted-foreground mt-4 min-h-80 text-sm'>
        This is an example of a modal content.
      </div>
    </DialogContent>
  )
}

export { DefaultModalExample }
`}
          </pre>
        ),
      }}
    />
  )
}

export { CardDefaultExample }

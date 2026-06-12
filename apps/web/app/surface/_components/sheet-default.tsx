'use client'

import { Button } from '@zxkit/ui/button'
import { pushModal } from '@/components/surface/modals'
import { SurfaceExampleCard } from '@/components/surface/example-card'

const CardSheetExample = () => {
  return (
    <SurfaceExampleCard
      header={{
        title: 'Sheet',
        subtitle: "Sheet only, this doesn't work with dynamic modals.",
      }}
      content={{
        preview: <Button onClick={() => pushModal('DefaultSheetExample')}>Open Sheet</Button>,
        code: (
          <pre className='bg-muted overflow-x-auto rounded-md p-4'>
            {`import { SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@zxkit/ui/sheet'

const DefaultSheetExample = () => {
  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Sheet</SheetTitle>
        <SheetDescription>The same stack can push a shadcn Sheet.</SheetDescription>
      </SheetHeader>
      <div className='text-muted-foreground px-4 text-sm'>
        Sheets are registered like any other modal — push, replace, and pop
        work the same way.
      </div>
    </SheetContent>
  )
}

export { DefaultSheetExample }
`}
          </pre>
        ),
      }}
    />
  )
}

export { CardSheetExample }

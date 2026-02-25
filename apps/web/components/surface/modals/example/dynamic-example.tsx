import { DialogDescription, DialogHeader, DialogTitle } from '@zxkit/ui/dialog'
import { DynamicContent } from '../dynamic'

const DynamicModalExample = () => {
  return (
    <DynamicContent>
      <DialogHeader>
        <DialogTitle>Dynamic Modal Example</DialogTitle>
        <DialogDescription>
          This modal is rendered dynamically when you push it using the pushModal function.
        </DialogDescription>
      </DialogHeader>
      <div className='text-muted-foreground mt-4 min-h-80 text-sm'>
        Drawer in mobile and dialog on desktop 🤘
      </div>
    </DynamicContent>
  )
}

export { DynamicModalExample }

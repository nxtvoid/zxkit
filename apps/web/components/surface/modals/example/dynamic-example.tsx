import { DialogDescription, DialogHeader, DialogTitle } from '@zxkit/ui/dialog'
import { DynamicContent } from '../dynamic'

const DynamicModalExample = () => {
  return (
    <DynamicContent>
      <DialogHeader>
        <DialogTitle>Responsive modal</DialogTitle>
        <DialogDescription>
          Dialog on desktop, drawer on mobile — the same component.
        </DialogDescription>
      </DialogHeader>
      <div className='text-muted-foreground mt-4 min-h-80 text-sm'>
        Resize the window with this open. Below the breakpoint it re-renders as a drawer without
        losing its place in the stack.
      </div>
    </DynamicContent>
  )
}

export { DynamicModalExample }

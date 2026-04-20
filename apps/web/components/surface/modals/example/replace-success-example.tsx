import { Button } from '@zxkit/ui/button'
import { DialogDescription, DialogHeader, DialogTitle } from '@zxkit/ui/dialog'
import { useModalControls } from '@zxkit/surface'
import { DynamicContent } from '../dynamic'

const ReplaceSuccessExample = () => {
  const { close } = useModalControls()

  return (
    <DynamicContent>
      <DialogHeader>
        <DialogTitle>Release ready</DialogTitle>
        <DialogDescription>
          The first modal was replaced in place instead of stacking another one.
        </DialogDescription>
      </DialogHeader>

      <div className='text-muted-foreground mt-4 space-y-4 text-sm'>
        <p>`replace` keeps the flow focused when the next screen supersedes the current modal.</p>

        <Button onClick={close}>Done</Button>
      </div>
    </DynamicContent>
  )
}

export { ReplaceSuccessExample }

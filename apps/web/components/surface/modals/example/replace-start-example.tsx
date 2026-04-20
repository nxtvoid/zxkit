import { Button } from '@zxkit/ui/button'
import { DialogDescription, DialogHeader, DialogTitle } from '@zxkit/ui/dialog'
import { useModalControls } from '@zxkit/surface'
import { DynamicContent } from '../dynamic'

const ReplaceStartExample = () => {
  const { replace, close } = useModalControls()

  return (
    <DynamicContent>
      <DialogHeader>
        <DialogTitle>Replace the current modal</DialogTitle>
        <DialogDescription>
          Move the flow forward without stacking a second modal on top of this one.
        </DialogDescription>
      </DialogHeader>

      <div className='text-muted-foreground mt-4 space-y-4 text-sm'>
        <p>
          This is useful for multi-step flows, success states, or confirmations where the previous
          step should disappear cleanly.
        </p>

        <div className='flex flex-col gap-2 sm:flex-row'>
          <Button onClick={() => replace('ReplaceSuccessExample' /* { ...props } */)}>
            Continue
          </Button>
          <Button variant='ghost' onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </DynamicContent>
  )
}

export { ReplaceStartExample }

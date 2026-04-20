import { Button } from '@zxkit/ui/button'
import { DialogDescription, DialogHeader, DialogTitle } from '@zxkit/ui/dialog'
import { useModalControls } from '@zxkit/surface'
import { DynamicContent } from '../dynamic'

const AsyncModalExample = () => {
  const { resolve, close } = useModalControls<boolean>()

  return (
    <DynamicContent>
      <DialogHeader>
        <DialogTitle>Publish this release?</DialogTitle>
        <DialogDescription>
          Await the modal result and update the UI when the promise resolves.
        </DialogDescription>
      </DialogHeader>

      <div className='text-muted-foreground mt-4 space-y-4 text-sm'>
        <p>
          `pushModalAsync` lets you await the user decision directly instead of wiring event
          listeners for every branch.
        </p>

        <div className='flex flex-col gap-2 sm:flex-row'>
          <Button onClick={() => resolve(true)}>Approve</Button>
          <Button variant='outline' onClick={() => resolve(false)}>
            Reject
          </Button>
          <Button variant='ghost' onClick={close}>
            Decide later
          </Button>
        </div>
      </div>
    </DynamicContent>
  )
}

export { AsyncModalExample }

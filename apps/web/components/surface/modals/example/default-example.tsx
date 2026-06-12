import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@zxkit/ui/dialog'

const DefaultModalExample = () => {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Plain dialog</DialogTitle>
        <DialogDescription>Pushed by name, no responsive wrapper.</DialogDescription>
      </DialogHeader>
      <div className='text-muted-foreground mt-4 text-sm'>
        The modal mounts when pushed and unmounts when closed. Anything a shadcn DialogContent
        accepts works here.
      </div>
    </DialogContent>
  )
}

export { DefaultModalExample }

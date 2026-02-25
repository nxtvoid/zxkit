import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@zxkit/ui/dialog'

const DefaultModalExample = () => {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Default Modal Example</DialogTitle>
        <DialogDescription>
          This modal is rendered dynamically when you push it using the pushModal function.
        </DialogDescription>
      </DialogHeader>
      <div className='text-muted-foreground mt-4 text-sm'>
        This is a default modal example. It uses the default dialog component provided by the
        library. It is a simple dialog that can be used for any purpose. You can customize it by
        passing your own content and styles.
      </div>
    </DialogContent>
  )
}

export { DefaultModalExample }

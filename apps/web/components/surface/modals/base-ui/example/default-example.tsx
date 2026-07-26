import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@zxkit/ui/base-ui/dialog'

const BaseDefaultModalExample = () => {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Base UI dialog</DialogTitle>
        <DialogDescription>Hosted by the registry&apos;s Base UI defaultWrapper.</DialogDescription>
      </DialogHeader>
      <div className='text-muted-foreground mt-4 text-sm'>
        No Wrapper is declared for this modal, so it falls back to the defaultWrapper passed to
        createPushModal — here, the Base UI Dialog root.
      </div>
    </DialogContent>
  )
}

export { BaseDefaultModalExample }

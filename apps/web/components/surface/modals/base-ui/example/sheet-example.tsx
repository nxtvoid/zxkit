import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@zxkit/ui/base-ui/sheet'

const BaseSheetModalExample = () => {
  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Base UI sheet</SheetTitle>
        <SheetDescription>The same stack can push a Base UI Sheet.</SheetDescription>
      </SheetHeader>
      <div className='text-muted-foreground px-4 text-sm'>
        Sheet and Dialog share the same Base UI root, so this modal needs no Wrapper of its own — it
        rides the same defaultWrapper as the plain dialog.
      </div>
    </SheetContent>
  )
}

export { BaseSheetModalExample }

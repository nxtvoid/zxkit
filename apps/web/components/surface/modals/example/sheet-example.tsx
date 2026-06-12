import { SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@zxkit/ui/sheet'

const DefaultSheetExample = () => {
  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Sheet</SheetTitle>
        <SheetDescription>The same stack can push a shadcn Sheet.</SheetDescription>
      </SheetHeader>
      <div className='text-muted-foreground px-4 text-sm'>
        Sheets are registered like any other modal — push, replace, and pop work the same way.
      </div>
    </SheetContent>
  )
}

export { DefaultSheetExample }

import { SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@zxkit/ui/sheet'

const DefaultSheetExample = () => {
  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Default Sheet Example</SheetTitle>
        <SheetDescription>
          This sheet is rendered dynamically when you push it using the pushModal function.
        </SheetDescription>
      </SheetHeader>
      <div className='text-muted-foreground px-4 text-sm'>
        This is a default sheet example. It uses the default sheet component provided by the
        library. It is a simple sheet that can be used for any purpose. You can customize it by
        passing your own content and styles.
      </div>
    </SheetContent>
  )
}

export { DefaultSheetExample }

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zxkit/ui/tabs'

const SurfaceExampleCode = () => {
  return (
    <Tabs
      defaultValue='index'
      className='border-border w-full gap-0 overflow-hidden rounded-lg border'
    >
      <TabsList className='border-border w-full rounded-none border-b'>
        <TabsTrigger value='index'>index.ts</TabsTrigger>
        <TabsTrigger value='dynamic'>dynamic.tsx</TabsTrigger>
      </TabsList>
      <TabsContent value='index' className='min-w-0'>
        <pre className='bg-muted/30 min-w-0 overflow-x-auto rounded-lg p-4 text-sm leading-relaxed'>
          <code className='text-foreground/90 font-mono text-[13px]'>
            {`import { createPushModal } from '@zxkit/surface'
import { DynamicWrapper } from './dynamic'

import { DefaultModalExample } from './example/default-example'
import { DefaultSheetExample } from './example/sheet-example'
import { DynamicModalExample } from './example/dynamic-example'
import { StateModalExample } from './example/state-example'
import { FormModalExample } from './example/form-example'

export const {
  pushModal,
  popModal,
  popAllModals,
  replaceWithModal,
  useOnPushModal,
  onPushModal,
  ModalProvider
} = createPushModal({
  modals: {
    // just dialog
    DefaultExample: DefaultModalExample,

    // sheet (this doesn't work with dynamic modals)
    DefaultSheetExample: DefaultSheetExample,

    // dynamic dialog/drawer based on breakpoint
    DynamicExample: {
      Wrapper: DynamicWrapper,
      Component: DynamicModalExample
    },
    StateExample: {
      Wrapper: DynamicWrapper,
      Component: StateModalExample
    },
    FormExample: {
      Wrapper: DynamicWrapper,
      Component: FormModalExample
    }
  }
})
`}
          </code>
        </pre>
      </TabsContent>
      <TabsContent value='dynamic' className='min-w-0'>
        <pre className='bg-muted/30 min-w-0 overflow-x-auto rounded-lg p-4 text-sm leading-relaxed'>
          <code className='text-foreground/90 font-mono text-[13px]'>
            {`import { createResponsiveWrapper } from '@zxkit/surface'

// shadcn dialog and drawer components
import { Dialog, DialogContent } from '@zxkit/ui/dialog'
import { Drawer, DrawerContent } from '@zxkit/ui/drawer'

const { 
  Wrapper, 
  Content, 
  usePreservedForm, 
  usePreservedState 
} = createResponsiveWrapper({
  desktop: {
    Wrapper: Dialog,
    Content: DialogContent
  },
  mobile: {
    Wrapper: Drawer,
    Content: DrawerContent
  },
  breakpoint: 640
})

export { 
  Wrapper as DynamicWrapper, 
  Content as DynamicContent, 
  usePreservedForm, 
  usePreservedState
}
`}
          </code>
        </pre>
      </TabsContent>
    </Tabs>
  )
}

export { SurfaceExampleCode }

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
        <TabsTrigger value='async'>async.tsx</TabsTrigger>
        <TabsTrigger value='replace'>replace.tsx</TabsTrigger>
      </TabsList>
      <TabsContent value='index' className='min-w-0'>
        <pre className='bg-muted/30 min-w-0 overflow-x-auto rounded-lg p-4 text-sm leading-relaxed'>
          <code className='text-foreground/90 font-mono text-[13px]'>
            {`import { createPushModal, modal } from '@zxkit/surface'
import { DynamicWrapper } from './dynamic'

import { DefaultModalExample } from './example/default-example'
import { DefaultSheetExample } from './example/sheet-example'
import { DynamicModalExample } from './example/dynamic-example'
import { AsyncModalExample } from './example/async-example'
import { StateModalExample } from './example/state-example'
import { FormModalExample } from './example/form-example'
import { ReplaceStartExample } from './example/replace-start-example'
import { ReplaceSuccessExample } from './example/replace-success-example'

export const {
  pushModal,
  pushModalAsync,
  popModal,
  popAllModals,
  replaceWithModal,
  useOnPushModal,
  onPushModal,
  ModalProvider
} = createPushModal({
  modals: {
    // just dialog
    DefaultExample: modal<Record<never, never>>(DefaultModalExample),

    // sheet (this doesn't work with dynamic modals)
    DefaultSheetExample: modal<Record<never, never>>(DefaultSheetExample),

    // dynamic dialog/drawer based on breakpoint
    DynamicExample: modal<Record<never, never>>({
      Wrapper: DynamicWrapper,
      Component: DynamicModalExample
    }),
    AsyncExample: modal<React.ComponentProps<typeof AsyncModalExample>, boolean>({
      Wrapper: DynamicWrapper,
      Component: AsyncModalExample
    }),
    ReplaceStartExample: modal<Record<never, never>>({
      Wrapper: DynamicWrapper,
      Component: ReplaceStartExample
    }),
    ReplaceSuccessExample: modal<React.ComponentProps<typeof ReplaceSuccessExample>>({
      Wrapper: DynamicWrapper,
      Component: ReplaceSuccessExample
    }),
    StateExample: modal<Record<never, never>>({
      Wrapper: DynamicWrapper,
      Component: StateModalExample
    }),
    FormExample: modal<Record<never, never>>({
      Wrapper: DynamicWrapper,
      Component: FormModalExample
    })
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
      <TabsContent value='async' className='min-w-0'>
        <pre className='bg-muted/30 min-w-0 overflow-x-auto rounded-lg p-4 text-sm leading-relaxed'>
          <code className='text-foreground/90 font-mono text-[13px]'>
            {`import { useModalControls } from '@zxkit/surface'

const result = await pushModalAsync('AsyncExample')

const AsyncModalExample = () => {
  const { resolve, close } = useModalControls<boolean>()

  return (
    <>
      <button onClick={() => resolve(true)}>Approve</button>
      <button onClick={() => resolve(false)}>Reject</button>
      <button onClick={close}>Decide later</button>
    </>
  )
}
`}
          </code>
        </pre>
      </TabsContent>
      <TabsContent value='replace' className='min-w-0'>
        <pre className='bg-muted/30 min-w-0 overflow-x-auto rounded-lg p-4 text-sm leading-relaxed'>
          <code className='text-foreground/90 font-mono text-[13px]'>
            {`import { useModalControls } from '@zxkit/surface'

const flow = pushModal('ReplaceStartExample')

flow.replace('ReplaceSuccessExample', {
  title: 'Release ready'
})

const ReplaceStartExample = () => {
  const { replace } = useModalControls()

  return (
    <button
      onClick={() =>
        replace('ReplaceSuccessExample', {
          title: 'Release ready'
        })
      }
    >
      Continue
    </button>
  )
}
`}
          </code>
        </pre>
      </TabsContent>
    </Tabs>
  )
}

export { SurfaceExampleCode }

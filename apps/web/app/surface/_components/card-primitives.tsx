'use client'

import { Button } from '@zxkit/ui/button'
import { pushModal } from '@/components/surface/modals'
import { pushBaseModal } from '@/components/surface/modals/base-ui'
import { SurfaceExampleCard } from '@/components/surface/example-card'

const CardPrimitivesExample = () => {
  return (
    <SurfaceExampleCard
      header={{
        title: 'Radix and Base UI, same API',
        subtitle: 'Two independent stacks on this page. surface depends on neither.',
        badgeText: 'Agnostic',
      }}
      classes={{
        tabCode: 'justify-baseline items-baseline',
      }}
      content={{
        preview: (
          <div className='flex flex-col items-center gap-4'>
            <div className='flex flex-wrap items-center justify-center gap-3'>
              <Button variant='outline' onClick={() => pushModal('DefaultExample')}>
                Radix dialog
              </Button>
              <Button variant='outline' onClick={() => pushBaseModal('BaseDefaultExample')}>
                Base UI dialog
              </Button>
            </div>
            <div className='flex flex-wrap items-center justify-center gap-3'>
              <Button variant='outline' onClick={() => pushModal('DefaultSheetExample')}>
                Radix sheet
              </Button>
              <Button variant='outline' onClick={() => pushBaseModal('BaseSheetExample')}>
                Base UI sheet
              </Button>
            </div>
            <div className='flex flex-wrap items-center justify-center gap-3'>
              <Button onClick={() => pushModal('StateExample')}>Radix responsive</Button>
              <Button onClick={() => pushBaseModal('BaseStateExample')}>Base UI responsive</Button>
            </div>
            <p className='text-muted-foreground max-w-sm text-center text-xs leading-5'>
              Resize past the breakpoint with a responsive one open — both swap to a drawer and keep
              their input.
            </p>
          </div>
        ),
        code: (
          <pre className='bg-muted size-full flex-1 grow overflow-x-auto rounded-md p-4'>
            {`// modals/index.ts — Radix
import { Dialog } from '@zxkit/ui/dialog'

export const { pushModal, ModalProvider } = createPushModal({
  defaultWrapper: Dialog,
  modals: { DefaultExample: modal<Record<never, never>>(DefaultModalExample) },
})

// modals/base-ui/index.ts — Base UI
import { Dialog } from '@zxkit/ui/base-ui/dialog'

export const { pushModal: pushBaseModal, ModalProvider: BaseModalProvider } =
  createPushModal({
    defaultWrapper: Dialog,
    modals: { BaseDefaultExample: modal<Record<never, never>>(BaseDefaultModalExample) },
  })

// same for the responsive wrapper
createResponsiveWrapper({
  desktop: { Wrapper: Dialog, Content: DialogContent },
  mobile: { Wrapper: Drawer, Content: DrawerContent },
})
`}
          </pre>
        ),
      }}
    />
  )
}

export { CardPrimitivesExample }

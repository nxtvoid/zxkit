export const registryExample = `import { createPushModal, modal } from '@zxkit/surface'
import { DynamicWrapper } from './dynamic'

export const { pushModal, pushModalAsync, popModal, ModalProvider } =
  createPushModal({
    modals: {
      EditOrder: modal<{ orderId: string }>(EditOrderModal),
      ConfirmDelete: modal<Record<never, never>, boolean>({
        Wrapper: DynamicWrapper,
        Component: ConfirmDeleteModal,
      }),
    },
  })`

export const responsiveExample = `import { createResponsiveWrapper } from '@zxkit/surface'
import { Dialog, DialogContent } from '@zxkit/ui/dialog'
import { Drawer, DrawerContent } from '@zxkit/ui/drawer'

export const { Wrapper, Content, usePreservedState, usePreservedForm } =
  createResponsiveWrapper({
    desktop: { Wrapper: Dialog, Content: DialogContent },
    mobile: { Wrapper: Drawer, Content: DrawerContent },
    breakpoint: 640,
  })

export { Wrapper as DynamicWrapper }`

export const usageExample = `pushModal('EditOrder', { orderId })

const confirmed = await pushModalAsync('ConfirmDelete')

if (confirmed) {
  await deleteOrder(orderId)
}`

export const features = [
  {
    title: 'Responsive by breakpoint',
    description: 'The same modal renders as a Dialog on desktop and a Drawer on mobile.',
  },
  {
    title: 'Preserved state',
    description: 'usePreservedState and usePreservedForm survive the Dialog ↔ Drawer swap.',
  },
  {
    title: 'Modal stack',
    description: 'Push, replace, and pop modals with a router-like flow.',
  },
  {
    title: 'Async modals',
    description: 'await pushModalAsync and resolve a typed result from inside the modal.',
  },
  {
    title: 'Event-driven',
    description: 'React to opens and closes with onPushModal and useOnPushModal.',
  },
]

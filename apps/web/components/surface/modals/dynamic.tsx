import { createResponsiveWrapper } from '@zxkit/surface'
import { createPreservedForm } from '@zxkit/surface/react-hook-form'
import { Dialog, DialogContent } from '@zxkit/ui/dialog'
import { Drawer, DrawerContent } from '@zxkit/ui/drawer'

const { Wrapper, Content, usePreservedState, usePreservedStore } = createResponsiveWrapper({
  desktop: {
    Wrapper: Dialog,
    Content: DialogContent,
  },
  mobile: {
    Wrapper: Drawer,
    Content: DrawerContent,
  },
  breakpoint: 640,
})

const usePreservedForm = createPreservedForm(usePreservedStore)

export { Wrapper as DynamicWrapper, Content as DynamicContent, usePreservedForm, usePreservedState }

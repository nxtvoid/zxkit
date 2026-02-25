import { createResponsiveWrapper } from '@zxkit/surface'
import { Dialog, DialogContent } from '@zxkit/ui/dialog'
import { Drawer, DrawerContent } from '@zxkit/ui/drawer'

const { Wrapper, Content, usePreservedForm, usePreservedState } = createResponsiveWrapper({
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

export { Wrapper as DynamicWrapper, Content as DynamicContent, usePreservedForm, usePreservedState }

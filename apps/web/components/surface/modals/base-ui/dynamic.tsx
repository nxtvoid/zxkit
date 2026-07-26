import { createResponsiveWrapper } from '@zxkit/surface'
import { Dialog, DialogContent } from '@zxkit/ui/base-ui/dialog'
import { Drawer, DrawerContent } from '@zxkit/ui/base-ui/drawer'

// Same call as the Radix system in ../dynamic.tsx — only the components differ.
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

export {
  Wrapper as BaseDynamicWrapper,
  Content as BaseDynamicContent,
  usePreservedState as useBasePreservedState,
  usePreservedStore as useBasePreservedStore,
}

import { createPushModal, modal } from '@zxkit/surface'
import { Dialog } from '@zxkit/ui/base-ui/dialog'

import { BaseDynamicWrapper } from './dynamic'
import { BaseDefaultModalExample } from './example/default-example'
import { BaseSheetModalExample } from './example/sheet-example'
import { BaseStateModalExample } from './example/state-example'

// A second, fully independent modal stack — identical surface API to the Radix
// registry in ../index.ts, wired to Base UI primitives instead.
export const {
  pushModal: pushBaseModal,
  popModal: popBaseModal,
  ModalProvider: BaseModalProvider,
} = createPushModal({
  defaultWrapper: Dialog,
  modals: {
    BaseDefaultExample: modal(BaseDefaultModalExample),

    // Sheet shares the Base UI Dialog root, so it rides the same defaultWrapper.
    BaseSheetExample: modal(BaseSheetModalExample),

    BaseStateExample: modal({
      Wrapper: BaseDynamicWrapper,
      Component: BaseStateModalExample,
    }),
  },
})

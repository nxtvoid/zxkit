import { createPushModal } from '@zxkit/surface'
import { DynamicWrapper } from './dynamic'

import { DefaultModalExample } from './example/default-example'
import { DynamicModalExample } from './example/dynamic-example'
import { StateModalExample } from './example/state-example'
import { FormModalExample } from './example/form-example'
import { DefaultSheetExample } from './example/sheet-example'

export const {
  pushModal,
  popModal,
  popAllModals,
  replaceWithModal,
  useOnPushModal,
  onPushModal,
  ModalProvider,
} = createPushModal({
  modals: {
    // just dialog
    DefaultExample: DefaultModalExample,

    // sheet (this doesn't work with dynamic modals)
    DefaultSheetExample: DefaultSheetExample,

    // dynamic dialog/drawer based on breakpoint
    DynamicExample: {
      Wrapper: DynamicWrapper,
      Component: DynamicModalExample,
    },
    StateExample: {
      Wrapper: DynamicWrapper,
      Component: StateModalExample,
    },
    FormExample: {
      Wrapper: DynamicWrapper,
      Component: FormModalExample,
    },
  },
})

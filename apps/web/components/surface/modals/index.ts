import type React from 'react'
import { createPushModal, modal } from '@zxkit/surface'
import { DynamicWrapper } from './dynamic'

import { DefaultModalExample } from './example/default-example'
import { DynamicModalExample } from './example/dynamic-example'
import { StateModalExample } from './example/state-example'
import { FormModalExample } from './example/form-example'
import { DefaultSheetExample } from './example/sheet-example'
import { AsyncModalExample } from './example/async-example'
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
  ModalProvider,
} = createPushModal({
  modals: {
    // just dialog
    DefaultExample: modal<Record<never, never>>(DefaultModalExample),

    // sheet (this doesn't work with dynamic modals)
    DefaultSheetExample: modal<Record<never, never>>(DefaultSheetExample),

    // dynamic dialog/drawer based on breakpoint
    DynamicExample: modal<Record<never, never>>({
      Wrapper: DynamicWrapper,
      Component: DynamicModalExample,
    }),
    StateExample: modal<Record<never, never>>({
      Wrapper: DynamicWrapper,
      Component: StateModalExample,
    }),
    FormExample: modal<Record<never, never>>({
      Wrapper: DynamicWrapper,
      Component: FormModalExample,
    }),
    AsyncExample: modal<React.ComponentProps<typeof AsyncModalExample>, boolean>({
      Wrapper: DynamicWrapper,
      Component: AsyncModalExample,
    }),
    ReplaceStartExample: modal<Record<never, never>>({
      Wrapper: DynamicWrapper,
      Component: ReplaceStartExample,
    }),
    ReplaceSuccessExample: modal<React.ComponentProps<typeof ReplaceSuccessExample>>({
      Wrapper: DynamicWrapper,
      Component: ReplaceSuccessExample,
    }),
  },
})

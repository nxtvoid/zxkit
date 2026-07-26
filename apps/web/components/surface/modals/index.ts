import { createPushModal, flow, modal } from '@zxkit/surface'
import { Dialog } from '@zxkit/ui/dialog'
import { DynamicContent, DynamicWrapper } from './dynamic'
import { flowSteps } from './flow/steps'

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
  // Most modals here are responsive, so DynamicWrapper is the default and the two
  // that render a plain Dialog or Sheet opt out with their own Wrapper. Props are
  // inferred from each Component — no generics needed.
  defaultWrapper: DynamicWrapper,
  modals: {
    // plain dialog / sheet — Sheet shares the Dialog root under the hood
    DefaultExample: modal({ Wrapper: Dialog, Component: DefaultModalExample }),
    DefaultSheetExample: modal({ Wrapper: Dialog, Component: DefaultSheetExample }),

    // dynamic dialog/drawer based on breakpoint
    DynamicExample: modal(DynamicModalExample),
    StateExample: modal(StateModalExample),
    FormExample: modal(FormModalExample),
    AsyncExample: modal<boolean>()(AsyncModalExample),
    ReplaceStartExample: modal(ReplaceStartExample),
    ReplaceSuccessExample: modal(ReplaceSuccessExample),

    // multi-step: the shell is rendered once, so stepping never replays the
    // open animation the way replacing one modal with another does. No Wrapper,
    // so it rides the defaultWrapper like the modals above.
    CheckoutFlow: flow<boolean>()({
      Content: DynamicContent,
      initial: 'plan',
      steps: flowSteps,
    }),
  },
})

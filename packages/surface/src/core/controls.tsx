'use client'

import React from 'react'

import type { ModalName } from './types'

export interface ModalControlsContextValue<TResult = unknown> {
  key: string
  name: ModalName
  close: () => void
  resolve: (value?: TResult) => void
  reject: (reason?: unknown) => void
  replace: <TName extends ModalName>(name: TName, props?: Record<string, unknown>) => void
}

export const ModalControlsContext = React.createContext<ModalControlsContextValue | null>(null)

/** Use inside a modal component created through `createPushModal`. */
export function useModalControls<TResult = unknown>() {
  const context = React.useContext(ModalControlsContext)

  if (!context) {
    throw new Error('useModalControls must be used within a modal created by createPushModal')
  }

  return context as ModalControlsContextValue<TResult>
}

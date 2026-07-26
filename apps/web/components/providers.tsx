'use client'

import * as React from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@zxkit/ui/sonner'
import { ModalProvider } from './surface/modals'
import { BaseModalProvider } from './surface/modals/base-ui'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute='class'
      storageKey='zxkit-theme'
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      {children}

      <Toaster position='bottom-center' closeButton />
      <ModalProvider />
      <BaseModalProvider />
    </ThemeProvider>
  )
}

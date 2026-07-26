'use client'

import React, { useEffect, useState } from 'react'

import type { ModalWrapperProps } from './types'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : React.useLayoutEffect

/**
 * Renders the wrapper closed for one render, then opens it, so primitives that read
 * their enter animation off the open transition see it. The flip runs in a layout
 * effect, so both renders commit before the browser paints.
 */
export function ModalRoot({
  Root,
  open,
  onOpenChange,
  children,
}: {
  Root: React.ComponentType<ModalWrapperProps>
  open: boolean
  onOpenChange: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [entered, setEntered] = useState(false)

  useIsoLayoutEffect(() => {
    setEntered(true)
  }, [])

  return (
    <Root open={open && entered} onOpenChange={onOpenChange}>
      {children}
    </Root>
  )
}

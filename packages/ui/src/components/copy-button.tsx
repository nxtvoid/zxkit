'use client'

import * as React from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { cn } from '@zxkit/ui/lib/utils'

type CopyButtonProps = {
  value: string
  className?: string
}

const CopyButton = ({ value, className }: CopyButtonProps) => {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type='button'
      aria-label='Copy to clipboard'
      onClick={copy}
      className={cn(
        'text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors',
        className
      )}
    >
      {copied ? <CheckIcon className='size-3.5' /> : <CopyIcon className='size-3.5' />}
    </button>
  )
}

export { CopyButton }

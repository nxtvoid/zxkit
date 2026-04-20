'use client'

import { useState } from 'react'
import { Button } from '@zxkit/ui/button'
import { Badge } from '@zxkit/ui/badge'
import { pushModalAsync } from '@/components/surface/modals'
import { SurfaceExampleCard } from '@/components/surface/example-card'

const CardAsyncExample = () => {
  const [result, setResult] = useState<'approved' | 'rejected' | 'dismissed' | null>(null)

  const handleOpen = async () => {
    const response = await pushModalAsync('AsyncExample' /* { ...props } */)

    if (response === true) {
      setResult('approved')
      return
    }

    if (response === false) {
      setResult('rejected')
      return
    }

    setResult('dismissed')
  }

  return (
    <SurfaceExampleCard
      header={{
        title: 'Async',
        subtitle: 'Await the modal result like a promise.',
        badgeText: 'Promise API',
      }}
      classes={{
        tabCode: 'justify-baseline items-baseline',
      }}
      content={{
        preview: (
          <div className='flex flex-col items-center gap-4'>
            <Button onClick={() => void handleOpen()}>Open Async Modal</Button>
            {result && (
              <Badge variant='secondary' className='capitalize'>
                Result: {result}
              </Badge>
            )}
          </div>
        ),
        code: (
          <pre className='bg-muted size-full flex-1 grow overflow-x-auto rounded-md p-4'>
            {`const result = await pushModalAsync('AsyncExample' /* { ...props } */)

if (result === true) {
  console.log('approved')
} else if (result === false) {
  console.log('rejected')
} else {
  console.log('dismissed')
}
`}
          </pre>
        ),
      }}
    />
  )
}

export { CardAsyncExample }

'use client'

import { useState } from 'react'
import { noti, useNoti } from '@zxkit/noti'
import { Button } from '@zxkit/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zxkit/ui/card'

function DemoPanel() {
  const scopedNoti = useNoti()

  function runTask() {
    void scopedNoti.promise(new Promise<void>((resolve) => setTimeout(resolve, 3_000)), {
      position: 'bottom-center',
      loading: {
        title: 'Working for three seconds…',
        description: 'Unmount the panel before this finishes.',
        keepExpanded: true,
      },
      success: {
        title: 'Task complete',
        description: 'This result also belongs to the panel.',
        duration: null,
        keepExpanded: true,
      },
    })
  }

  return (
    <div className='flex flex-wrap gap-2'>
      <Button
        size='sm'
        onClick={() => {
          scopedNoti.info({
            title: 'This notification belongs to the panel',
            description: 'Unmount the panel to close it automatically.',
            position: 'bottom-center',
            duration: null,
            keepExpanded: true,
          })
        }}
      >
        Show notification
      </Button>
      <Button size='sm' variant='outline' onClick={runTask}>
        Run 3-second task
      </Button>
    </div>
  )
}

export function NotiLifecycleDemo() {
  const [mounted, setMounted] = useState(true)

  return (
    <section aria-labelledby='lifecycle-demo-title' className='mt-14'>
      <Card>
        <CardHeader>
          <CardTitle id='lifecycle-demo-title'>Live example · useNoti()</CardTitle>
          <CardDescription>
            Show a notification, then unmount its panel. Try unmounting during the task, too: the
            late result will stay closed.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          <div className='flex flex-wrap gap-2'>
            <Button size='sm' variant='outline' onClick={() => setMounted((value) => !value)}>
              {mounted ? 'Unmount panel' : 'Mount panel'}
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                noti.info({
                  title: 'A global notification',
                  description: 'Unmounting the panel leaves this replacement visible.',
                  position: 'bottom-center',
                  duration: 6_000,
                  keepExpanded: true,
                })
              }}
            >
              Replace with global
            </Button>
          </div>
          <p role='status' className='text-muted-foreground font-mono text-xs'>
            {mounted ? 'Panel mounted' : 'Panel unmounted — mount it to try again.'}
          </p>
          {mounted && <DemoPanel />}
        </CardContent>
      </Card>
    </section>
  )
}

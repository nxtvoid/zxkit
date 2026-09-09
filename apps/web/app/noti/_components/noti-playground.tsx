'use client'

import { useRef, useState } from 'react'
import { noti, type NotiPosition } from '@zxkit/noti'
import { Button } from '@zxkit/ui/button'
import Image from 'next/image'
import { Trash } from 'lucide-react'

const POSITIONS: NotiPosition[] = [
  'bottom-right',
  'bottom-center',
  'bottom-left',
  'top-left',
  'top-center',
  'top-right',
]

export function NotiPlayground() {
  const [position, setPosition] = useState<NotiPosition>('bottom-right')
  const slowResult = useRef(0)
  const [confirmationResult, setConfirmationResult] = useState('No decision yet.')

  // confirm "action" with fake delay
  const onConfirmAction = async () => {
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.35) resolve()
        else reject(new Error('Network unreachable'))
      }, 1_500)
    })
  }

  function runNotificationConfirm() {
    let decided = false
    setConfirmationResult('Waiting for the notification action.')
    noti.action({
      title: 'Delete product?',
      description: 'Delete Desk? Choose Cancel to keep it. This demo deletes no data.',
      duration: null,
      keepExpanded: true,
      dismissible: false,
      position: 'top-center',
      icon: <Trash />,
      cancelButton: {
        title: 'Cancel',
        onClick: () => {
          decided = true
          setConfirmationResult('Cancelled. Product kept.')
        },
        dismissOnSuccess: true,
      },
      button: {
        title: 'Delete product',
        onClick: () => {
          // In an app, perform the deletion only from this explicit action.
          decided = true
          setConfirmationResult('Confirmed through a notification. No data was deleted.')

          noti.promise(onConfirmAction, {
            loading: { title: 'Deleting product…' },
            success: {
              title: 'Deletion confirmed',
              description: 'Demo only — Desk was not deleted.',
              duration: 7_000,
            },
            error: {
              title: 'Could not delete',
              description: 'Demo only — Desk was not deleted.',
              duration: 7_000,
            },
          })
        },
      },
      onDismiss: () => {
        if (!decided) setConfirmationResult('Notification dismissed. Product kept.')
      },
    })
  }

  function runPromise() {
    void noti
      .promise(
        new Promise<{ name: string }>((resolve, reject) => {
          setTimeout(() => {
            if (Math.random() > 0.35) resolve({ name: 'zxkit' })
            else reject(new Error('Network unreachable'))
          }, 1_500)
        }),
        {
          loading: { title: 'Saving project…' },
          success: (project) => ({
            title: 'Project saved',
            description: `Everything in ${project.name} is up to date.`,
          }),
          error: (error) => ({
            title: 'Could not save',
            description: error instanceof Error ? error.message : String(error),
          }),
        }
      )
      .catch(() => {})
  }

  function runLatestWins() {
    const attempt = (slowResult.current += 1)

    void noti
      .promise(new Promise<number>((resolve) => setTimeout(() => resolve(attempt), 2_000)), {
        loading: { title: 'Slow request…' },
        success: (value) => ({ title: `Slow request ${value} finished` }),
      })
      .catch(() => {})

    setTimeout(() => {
      noti.info({
        title: 'Something else happened',
        description: 'The slow request is still running, but it no longer owns the island.',
      })
    }, 700)
  }

  function runRapidReplace() {
    const steps = [
      () => noti.info({ title: 'Connecting', description: 'Reaching the server…' }),
      () => noti.warning({ title: 'Retrying', description: 'The first attempt timed out.' }),
      () => noti.success({ title: 'Connected', description: 'Same node, one continuous morph.' }),
    ]

    steps.forEach((step, index) => {
      setTimeout(step, index * 450)
    })
  }

  const actions = [
    { label: 'Confirm via notification', run: runNotificationConfirm },
    {
      label: 'Success',
      run: () =>
        noti.success({
          title: 'Changes saved',
          description: 'All 12 records synced. It opens briefly, then returns to a pill.',
        }),
    },
    {
      label: 'Error',
      run: () =>
        noti.error({
          title: 'Could not save',
          description: 'The server rejected the request.',
        }),
    },
    {
      label: 'Warning',
      run: () =>
        noti.warning({
          title: 'Session expiring',
          description: 'You will be signed out in two minutes.',
        }),
    },
    {
      label: 'Info',
      run: () =>
        noti.info({
          title: 'Team update',
          description: (
            <div className='flex flex-col gap-2'>
              <div className='flex -space-x-2'>
                <Image
                  src='/01.png'
                  className='size-7 rounded-full ring-2 ring-white'
                  width={28}
                  height={28}
                  alt='Alice'
                />
                <Image
                  src='/02.png'
                  className='size-7 rounded-full ring-2 ring-white'
                  width={28}
                  height={28}
                  alt='Bob'
                />
                <Image
                  src='/03.png'
                  className='size-7 rounded-full ring-2 ring-white'
                  width={28}
                  height={28}
                  alt='Charlie'
                />
              </div>
              <span className='text-muted-foreground! text-xs!'>
                Alice, Bob, and Sarah joined the Design Engineering Team.
              </span>
            </div>
          ),
        }),
    },
    {
      label: 'Action',
      run: () =>
        noti.action({
          title: 'File uploaded',
          description: 'Your file is ready. Share it with your team?',
          button: {
            title: 'Share now',
            onClick: () => {
              noti.success({ title: 'Link copied' })
            },
          },
        }),
    },
    {
      label: 'On demand',
      run: () =>
        noti.info({
          title: 'Quiet update',
          description: 'autopilot: false — hover, focus or tap the pill to read this.',
          autopilot: false,
          // Sticky as well as quiet: a notification that never opens by itself
          // should not disappear while you are deciding to look at it.
          duration: null,
        }),
    },
    {
      label: 'Long title',
      run: () =>
        noti.info({
          title: 'Synchronising every single record in this workspace right now',
          description: 'Expand the island to read the complete title.',
          duration: null,
        }),
    },
    {
      label: 'Sticky',
      run: () =>
        noti.error({
          title: 'Payment declined',
          description: 'duration: null — this one waits for you.',
          duration: null,
        }),
    },
    {
      label: 'Loading',
      run: () =>
        noti.show({
          type: 'loading',
          title: 'Uploading file…',
          description: 'Your upload is in progress. Details remain available while loading.',
          duration: null,
        }),
    },
    {
      label: 'Bottom center',
      run: () =>
        noti.show({
          type: 'info',
          title: 'Bottom-center notification',
          description: 'This notification is centered horizontally along the bottom edge.',
          position: 'bottom-center',
          duration: null,
        }),
    },
    { label: 'Promise', run: runPromise },
    { label: 'Latest wins', run: runLatestWins },
    { label: 'Rapid replace', run: runRapidReplace },
    {
      label: 'Move position',
      run: () => {
        const next = POSITIONS[(POSITIONS.indexOf(position) + 1) % POSITIONS.length] ?? 'top-right'
        setPosition(next)
        noti.success({ title: 'Moved', description: `Now anchored ${next}.`, position: next })
      },
    },
  ]

  return (
    <div className='grid gap-4'>
      <p role='status' className='text-muted-foreground text-xs'>
        {confirmationResult}
      </p>
      <div className='flex flex-wrap gap-2'>
        {actions.map((action) => (
          <Button key={action.label} variant='outline' size='sm' onClick={action.run}>
            {action.label}
          </Button>
        ))}
        <Button
          variant='ghost'
          size='sm'
          onClick={() => {
            noti.dismiss()
          }}
        >
          Dismiss
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => {
            noti.clear(position)
          }}
        >
          Clear {position}
        </Button>
      </div>

      <p className='text-muted-foreground text-xs leading-5'>
        Notification buttons replace the same island — press them as fast as you like and there is
        still exactly one <span className='font-mono'>[data-noti-item]</span> on the page, on the
        same DOM node. Hover it — or tap it, where nothing can hover — to hold its countdown, tab
        into it to hold it again, and switch browser tabs to hold it a third way: three independent
        reasons on one timer.
      </p>
      <p className='text-muted-foreground text-xs leading-5'>
        Confirm via notification stays expanded until you choose Cancel or Delete. It uses ordinary
        notification actions, so another notification can still replace it.
      </p>
    </div>
  )
}

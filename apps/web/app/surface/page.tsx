import { Metadata } from 'next'
import { Badge } from '@zxkit/ui/badge'
import { Card } from '@zxkit/ui/card'
import { CardFormExample } from './_components/card-form'
import { CardStateExample } from './_components/card-state'
import { CardSheetExample } from './_components/sheet-default'
import { CardDynamicExample } from './_components/card-dynamic'
import { CardDefaultExample } from './_components/card-default'
import { SurfaceExampleCode } from '@/components/surface/example-code'
import { ArrowRightIcon, MonitorPlayIcon, SmartphoneIcon } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Surface',
  description: 'Handle your dialog, sheet and drawer with ease.',
}

export default function Page() {
  return (
    <section className='mx-auto flex max-w-3xl flex-col items-center justify-center gap-6'>
      <article className='flex w-full flex-col items-center gap-6'>
        <Badge className='border-border gap-2 px-4 py-1.5' variant='secondary'>
          <div className='flex items-center gap-2'>
            <MonitorPlayIcon className='size-3.5' />
            <ArrowRightIcon className='size-3' />
            <SmartphoneIcon className='size-3.5' />
          </div>
          responsive
        </Badge>
        <div className='text-center'>
          <h1 className='text-foreground text-4xl font-bold tracking-tight text-balance md:text-5xl lg:text-6xl'>
            Surface
          </h1>
          <p className='text-muted-foreground max-w-2xl text-lg leading-relaxed text-balance md:text-xl'>
            Handle your dialog, sheet and drawer with ease.
          </p>
        </div>

        <SurfaceExampleCode />
      </article>

      <article className='grid gap-2 py-20 sm:grid-cols-3'>
        <Card className='gap-1 p-3'>
          <h3 className='text-foreground font-semibold'>Responsive</h3>
          <p className='text-muted-foreground text-sm leading-relaxed'>
            Automatically switches between Dialog and Drawer based on the configured breakpoint.
          </p>
        </Card>
        <Card className='gap-1 p-3'>
          <h3 className='text-foreground font-semibold'>Persistent State</h3>
          <p className='text-muted-foreground text-sm leading-relaxed'>
            usePreservedState keeps values across re-mounts when the component transitions.
          </p>
        </Card>
        <Card className='gap-1 p-3'>
          <h3 className='text-foreground font-semibold'>Forms</h3>
          <p className='text-muted-foreground text-sm leading-relaxed'>
            usePreservedForm integrates react-hook-form with automatic store synchronization.
          </p>
        </Card>
      </article>

      <article className='flex w-full flex-col gap-12'>
        <div className='flex flex-col gap-3'>
          <h2 className='text-foreground text-2xl font-bold md:text-3xl'>Examples</h2>
          <p className='text-muted-foreground'>
            Try each example interactively. Resize the window to see the switch between Dialog and
            Drawer.
          </p>
        </div>

        <div className='flex flex-col gap-8'>
          <CardDefaultExample />

          <CardSheetExample />

          <CardDynamicExample />

          <CardStateExample />

          <CardFormExample />
        </div>
      </article>
    </section>
  )
}

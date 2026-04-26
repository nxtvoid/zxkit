import { cn } from '@zxkit/ui/lib/utils'
import { Badge } from '@zxkit/ui/badge'
import { TerminalIcon } from 'lucide-react'
import { COMPONENTS_OPTIONS } from '@/lib/components'
import Link from 'next/link'
import Image from 'next/image'

export default function Page() {
  return (
    <div className='flex flex-col gap-20 py-16'>
      <div className='grid gap-2'>
        <div className='flex items-center gap-2'>
          <div className='bg-primary size-2 rounded-full' />
          <span className='text-muted-foreground text-xs font-semibold uppercase'>
            A collection of tools
          </span>
        </div>
        <h1 className='w-full max-w-3xl text-5xl font-semibold tracking-normal'>
          Small, sharp tools for React developers.
        </h1>
        <p className='text-muted-foreground max-w-2xl text-lg leading-7'>
          A minimal suite of open-source libraries, built to compose well and stay out of your way.
        </p>
      </div>
      <div className='border-border grid *:not-last:border-b'>
        {COMPONENTS_OPTIONS.map((comp) => (
          <Link className='py-0.5' key={comp.title} href={comp.link}>
            <div
              className={cn(
                'hover:bg-sidebar transition-colors duration-200',
                'flex flex-col items-center gap-10 lg:flex-row',
                'rounded-lg px-5 py-14 md:px-10 md:py-16'
              )}
            >
              <div className='flex flex-1 flex-col gap-3'>
                <div className='flex items-center gap-2'>
                  <span className='text-base font-semibold'>{comp.title}</span>
                  {comp.version && (
                    <Badge
                      className='text-muted-foreground font-mono text-[0.7rem]'
                      variant='outline'
                    >
                      v{comp.version}
                    </Badge>
                  )}
                </div>
                <p className='text-muted-foreground max-w-md text-sm text-pretty'>
                  {comp.description}
                </p>

                {comp.command && (
                  <code className='bg-sidebar border-border text-muted-foreground flex w-fit items-center gap-2 rounded-md border p-2 font-mono text-xs'>
                    <TerminalIcon className='inline-block size-3' aria-hidden='true' />
                    {comp.command}
                  </code>
                )}
              </div>
              <Image
                src={comp.image.light}
                alt={comp.title}
                className='bg-muted/50 aspect-12/5 rounded-md object-cover lg:max-w-125 dark:hidden'
                width={(12 / 5) * 500}
                height={300}
                loading='eager'
              />
              <Image
                src={comp.image.dark}
                alt={comp.title}
                className='bg-muted/50 hidden aspect-12/5 rounded-md object-cover lg:max-w-125 dark:block'
                width={(12 / 5) * 500}
                height={300}
                loading='eager'
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

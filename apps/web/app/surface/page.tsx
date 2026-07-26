import type { Metadata } from 'next'
import { CodeBlock } from '@zxkit/ui/code-block'
import { CopyButton } from '@zxkit/ui/copy-button'
import { CardFormExample } from './_components/card-form'
import { CardStateExample } from './_components/card-state'
import { CardSheetExample } from './_components/sheet-default'
import { CardDynamicExample } from './_components/card-dynamic'
import { CardDefaultExample } from './_components/card-default'
import { CardAsyncExample } from './_components/card-async'
import { CardReplaceExample } from './_components/card-replace'
import { CardPrimitivesExample } from './_components/card-primitives'
import { features, registryExample, responsiveExample, usageExample } from './_components/content'

export const metadata: Metadata = {
  title: '@zxkit/surface',
  description: 'Responsive dialogs and drawers for React with a router-like modal stack.',
}

const sections = [
  {
    label: 'Define once',
    title: 'modals/index.ts',
    description: 'One typed registry. Push any modal from anywhere by name, with typed props.',
    code: registryExample,
  },
  {
    label: 'Responsive',
    title: 'modals/dynamic.tsx',
    description:
      'Wrap shadcn Dialog and Drawer once. Below the breakpoint the same modal becomes a drawer.',
    code: responsiveExample,
  },
  {
    label: 'Use',
    title: 'anywhere.tsx',
    description: 'Push with props, or await an async modal and get a typed result back.',
    code: usageExample,
  },
]

export default function SurfacePage() {
  return (
    <div className='mx-auto w-full max-w-2xl px-1 py-14 md:py-20'>
      <header>
        <p className='text-muted-foreground font-mono text-sm'>@zxkit/surface</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl'>
          Responsive dialogs and drawers with a modal stack.
        </h1>
        <p className='text-muted-foreground mt-4 text-base leading-7'>
          Bring your own primitives — Base UI, Radix, or anything with an{' '}
          <code className='font-mono text-sm'>open</code>/
          <code className='font-mono text-sm'>onOpenChange</code> root. Define your modals once,
          push them by name from anywhere, and let the breakpoint decide how they render — without
          losing state in the swap.
        </p>

        <div className='mt-8 flex flex-wrap items-center gap-x-6 gap-y-3'>
          <span className='bg-muted/30 inline-flex items-center gap-1 rounded-lg py-1 pr-1 pl-3'>
            <code className='font-mono text-sm'>bun add @zxkit/surface</code>
            <CopyButton value='bun add @zxkit/surface' />
          </span>
          <a
            className='text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors'
            href='https://github.com/nxtvoid/zxkit/tree/main/packages/surface#readme'
            target='_blank'
            rel='noopener noreferrer'
          >
            Documentation
          </a>
          <a
            className='text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors'
            href='https://www.npmjs.com/package/@zxkit/surface'
            target='_blank'
            rel='noopener noreferrer'
          >
            npm
          </a>
        </div>
      </header>

      {sections.map((section) => (
        <section key={section.title} className='border-border mt-14 border-t pt-10'>
          <p className='text-muted-foreground font-mono text-xs uppercase'>{section.label}</p>
          <h2 className='mt-2 font-mono text-sm font-medium'>{section.title}</h2>
          <p className='text-muted-foreground mt-2 text-sm leading-6'>{section.description}</p>
          <div className='mt-4'>
            <CodeBlock code={section.code} />
          </div>
        </section>
      ))}

      <section className='border-border mt-14 border-t pt-10'>
        <dl className='grid gap-5'>
          {features.map((feature) => (
            <div key={feature.title} className='grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4'>
              <dt className='text-sm font-medium'>{feature.title}</dt>
              <dd className='text-muted-foreground text-sm leading-6'>{feature.description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className='border-border mt-14 border-t pt-10'>
        <p className='text-muted-foreground font-mono text-xs uppercase'>Examples</p>
        <h2 className='mt-2 text-xl font-semibold tracking-tight'>Try them live.</h2>
        <p className='text-muted-foreground mt-2 text-sm leading-6'>
          Resize the window to see the switch between Dialog and Drawer.
        </p>

        <div className='mt-6 flex flex-col gap-6'>
          <CardPrimitivesExample />
          <CardDefaultExample />
          <CardSheetExample />
          <CardDynamicExample />
          <CardAsyncExample />
          <CardReplaceExample />
          <CardStateExample />
          <CardFormExample />
        </div>
      </section>
    </div>
  )
}

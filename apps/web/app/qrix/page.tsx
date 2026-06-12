import type { Metadata } from 'next'
import { CodeBlock } from '@zxkit/ui/code-block'
import { CopyButton } from '@zxkit/ui/copy-button'
import { QRIXView } from './_components/qrix-view'
import { features, renderExample, utilitiesExample } from './_components/content'

export const metadata: Metadata = {
  title: '@zxkit/qrix',
  description: 'QR codes as SVG for React, with logo support and download utilities.',
}

const sections = [
  {
    label: 'Render',
    title: 'qr-code.tsx',
    description: 'One component. Every knob from the playground above is a prop.',
    code: renderExample,
  },
  {
    label: 'Utilities',
    title: 'actions.ts',
    description: 'Download or copy the same QR you render — no canvas wiring on your side.',
    code: utilitiesExample,
  },
]

export default function QrixPage() {
  return (
    <div className='mx-auto w-full max-w-2xl px-1 py-14 md:py-20'>
      <header>
        <p className='text-muted-foreground font-mono text-sm'>@zxkit/qrix</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl'>
          QR codes as SVG, with a logo in the middle.
        </h1>
        <p className='text-muted-foreground mt-4 text-base leading-7'>
          A lightweight React component that renders crisp QR codes at any size, plus utilities to
          download them as PNG or SVG and copy them to the clipboard.
        </p>

        <div className='mt-8 flex flex-wrap items-center gap-x-6 gap-y-3'>
          <span className='bg-muted/30 inline-flex items-center gap-1 rounded-lg py-1 pr-1 pl-3'>
            <code className='font-mono text-sm'>bun add @zxkit/qrix</code>
            <CopyButton value='bun add @zxkit/qrix' />
          </span>
          <a
            className='text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors'
            href='https://github.com/nxtvoid/zxkit/tree/main/packages/qrix#readme'
            target='_blank'
            rel='noopener noreferrer'
          >
            Documentation
          </a>
          <a
            className='text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors'
            href='https://www.npmjs.com/package/@zxkit/qrix'
            target='_blank'
            rel='noopener noreferrer'
          >
            npm
          </a>
        </div>
      </header>

      <section className='border-border mt-14 border-t pt-10'>
        <p className='text-muted-foreground font-mono text-xs uppercase'>Playground</p>
        <h2 className='mt-2 text-xl font-semibold tracking-tight'>Try it live.</h2>
        <p className='text-muted-foreground mt-2 text-sm leading-6'>
          Tweak the QR below, then download it or copy it as an image.
        </p>

        <div className='mt-6'>
          <QRIXView />
        </div>
      </section>

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
    </div>
  )
}

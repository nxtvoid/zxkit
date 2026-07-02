import { CodeBlock } from '@zxkit/ui/code-block'
import { CopyButton } from '@zxkit/ui/copy-button'
import { boundaryExample, features, formatExample, rangesExample, zoneExample } from './content'

const sections = [
  {
    label: 'Boundary',
    title: 'parse once',
    description:
      'DB rows, form input, URL params — one parse at the edge returns null instead of throwing. Past it, failure is unrepresentable.',
    code: boundaryExample,
  },
  {
    label: 'Zone',
    title: 'app-date.ts',
    description:
      'Bind the IANA zone and locale once. The server can run in UTC anywhere; results never change.',
    code: zoneExample,
  },
  {
    label: 'Queries',
    title: 'ranges',
    description:
      'Half-open { gte, lt } instant ranges for timestamp filters, UTC-midnight bounds for DATE columns. No hand-built boundaries.',
    code: rangesExample,
  },
  {
    label: 'Display',
    title: 'formatting',
    description:
      'Intl-based formatting with the zone locale preset. Bad locales and options degrade to ISO strings instead of crashing.',
    code: formatExample,
  },
]

export function ChronoView() {
  return (
    <div className='mx-auto w-full max-w-2xl px-1 py-14 md:py-20'>
      <header>
        <p className='text-muted-foreground font-mono text-sm'>@zxkit/chrono</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl'>
          Calendar dates and instants that never throw.
        </h1>
        <p className='text-muted-foreground mt-4 text-base leading-7'>
          Your server runs in UTC; your business does not. chrono keeps calendar days and
          timezone-aware instants apart with a branded PlainDate and a total API — invalid input
          returns null, never an exception.
        </p>

        <div className='mt-8 flex flex-wrap items-center gap-x-6 gap-y-3'>
          <span className='bg-muted/30 inline-flex items-center gap-1 rounded-lg py-1 pr-1 pl-3'>
            <code className='font-mono text-sm'>bun add @zxkit/chrono</code>
            <CopyButton value='bun add @zxkit/chrono' />
          </span>
          <a
            className='text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors'
            href='https://github.com/nxtvoid/zxkit/tree/main/packages/chrono#readme'
            target='_blank'
            rel='noopener noreferrer'
          >
            Documentation
          </a>
          <a
            className='text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors'
            href='https://www.npmjs.com/package/@zxkit/chrono'
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
    </div>
  )
}

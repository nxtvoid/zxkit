import { CodeBlock } from '@zxkit/ui/code-block'
import { CopyButton } from '@zxkit/ui/copy-button'
import { clientExample, features, permissionExample, proxyExample, serverExample } from './content'

const sections = [
  {
    label: 'Define once',
    title: 'permissions.ts',
    description: 'One catalog of resources and actions. Everything else is typed from it.',
    code: permissionExample,
  },
  {
    label: 'Server',
    title: 'authz.ts',
    description: 'Session, adapter, and cache in one helper. protect wraps any server action.',
    code: serverExample,
  },
  {
    label: 'Client',
    title: 'authz-client.ts',
    description: 'Typed guards and hooks. No fetching — they read the snapshot you already loaded.',
    code: clientExample,
  },
  {
    label: 'Routes',
    title: 'proxy.ts',
    description: 'The same route definitions protect the whole app before anything renders.',
    code: proxyExample,
  },
]

export function AuthzView() {
  return (
    <div className='mx-auto w-full max-w-2xl px-1 py-14 md:py-20'>
      <header>
        <p className='text-muted-foreground font-mono text-sm'>@zxkit/authz</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl'>
          Typed authorization for roles, permissions, and routes.
        </h1>
        <p className='text-muted-foreground mt-4 text-base leading-7'>
          Your app already knows who the user is. This decides what they can see and run — once,
          with the same types on the server, the client, and the Next.js proxy.
        </p>

        <div className='mt-8 flex flex-wrap items-center gap-x-6 gap-y-3'>
          <span className='bg-muted/30 inline-flex items-center gap-1 rounded-lg py-1 pr-1 pl-3'>
            <code className='font-mono text-sm'>bun add @zxkit/authz</code>
            <CopyButton value='bun add @zxkit/authz' />
          </span>
          <a
            className='text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors'
            href='https://github.com/nxtvoid/zxkit/tree/main/packages/authz#readme'
            target='_blank'
            rel='noopener noreferrer'
          >
            Documentation
          </a>
          <a
            className='text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors'
            href='https://www.npmjs.com/package/@zxkit/authz'
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

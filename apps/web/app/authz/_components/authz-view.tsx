import { CodeBlock } from './code-block'
import {
  clientExample,
  flow,
  permissionExample,
  roleExample,
  serverExample,
  useCases,
} from './content'

export function AuthzView() {
  return (
    <div className='min-h-[calc(100vh-7rem)]'>
      <section className='border-border grid gap-8 border-b px-5 py-10 md:px-8 md:py-14 lg:grid-cols-[0.92fr_1.08fr]'>
        <div className='flex flex-col justify-center'>
          <p className='text-primary text-sm font-medium'>@zxkit/authz</p>
          <h1 className='mt-4 max-w-3xl text-4xl font-semibold tracking-normal text-balance md:text-6xl'>
            Typed authorization for roles, permissions, and routes.
          </h1>
          <p className='text-muted-foreground mt-5 max-w-2xl text-base leading-7 md:text-lg'>
            Use it when your app already has authentication, but still needs to decide what each
            user can see or run without duplicating rules across the server, client, Prisma, and the
            Next.js proxy.
          </p>
        </div>

        <div className='border-border bg-card flex flex-col gap-3 border p-4'>
          <div className='border-border flex h-fit items-center justify-between border-b pb-3'>
            <span className='text-primary text-sm font-medium'>permissions.ts</span>
            <span className='text-muted-foreground text-xs'>source of truth</span>
          </div>
          <CodeBlock code={permissionExample} />
        </div>
      </section>

      <section className='px-5 py-10 md:px-8'>
        <div className='mb-6 flex flex-col gap-2'>
          <p className='text-primary text-sm font-medium'>What it solves</p>
          <h2 className='text-2xl font-semibold tracking-normal md:text-3xl'>
            One access model for the whole app.
          </h2>
        </div>

        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
          {useCases.map((item) => {
            const Icon = item.icon

            return (
              <article key={item.title} className='border-border bg-card border p-4'>
                <Icon className='text-primary mb-4 size-5' aria-hidden='true' />
                <h3 className='text-lg font-semibold tracking-normal'>{item.title}</h3>
                <p className='text-secondary-foreground mt-2 text-sm leading-6'>
                  {item.description}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section className='border-border grid gap-5 border-y px-5 py-10 md:grid-cols-2 md:px-8'>
        <div>
          <p className='text-primary mb-3 text-sm font-medium'>Server</p>
          <CodeBlock code={serverExample} />
        </div>
        <div>
          <p className='text-primary mb-3 text-sm font-medium'>Client</p>
          <CodeBlock code={clientExample} />
        </div>
      </section>

      <section className='grid gap-8 px-5 py-10 md:px-8 lg:grid-cols-[0.9fr_1.1fr]'>
        <div>
          <p className='text-primary text-sm font-medium'>How it works</p>
          <h2 className='mt-3 text-2xl font-semibold tracking-normal md:text-3xl'>
            The usual flow is small.
          </h2>
          <ol className='mt-6 grid gap-3'>
            {flow.map((item, index) => (
              <li key={item} className='border-border bg-sidebar flex gap-3 border p-4'>
                <span className='bg-primary text-accent flex size-7 shrink-0 items-center justify-center text-sm font-semibold'>
                  {index + 1}
                </span>
                <span className='text-muted-foreground text-sm leading-6'>{item}</span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <p className='text-primary mb-3 text-sm font-medium'>Roles</p>
          <CodeBlock code={roleExample} />
          <p className='text-secondary-foreground mt-4 text-sm leading-6'>
            Creating or assigning roles returns a controlled result. If something already exists,
            you get
            <code className='bg-sidebar text-secondary-foreground mx-1 px-1 py-0.5'>
              success: false
            </code>
            instead of a raw database error.
          </p>
        </div>
      </section>
    </div>
  )
}

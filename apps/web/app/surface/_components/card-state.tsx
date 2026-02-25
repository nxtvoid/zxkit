'use client'

import { Button } from '@zxkit/ui/button'
import { pushModal } from '@/components/surface/modals'
import { SurfaceExampleCard } from '@/components/surface/example-card'

const CardStateExample = () => {
  return (
    <SurfaceExampleCard
      header={{
        title: 'Persistence with useState',
        subtitle: 'Custom state preserved across transitions.',
        badgeText: 'usePreservedState',
      }}
      classes={{
        tabCode: 'justify-baseline items-baseline',
      }}
      content={{
        preview: <Button onClick={() => pushModal('StateExample')}>Open with state</Button>,
        code: (
          <pre className='bg-muted size-full max-h-108 flex-1 grow overflow-auto rounded-md p-4'>
            {`import { toast } from 'sonner'
import { Input } from '@zxkit/ui/input'
import { Button } from '@zxkit/ui/button'
import { DynamicContent, usePreservedState } from '../dynamic'
import { DialogDescription, DialogHeader, DialogTitle } from '@zxkit/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from '@zxkit/ui/field'

const StateModalExample = () => {
  const [username, setName] = usePreservedState('username', '')
  const [email, setEmail] = usePreservedState('email', '')
  const [age, setAge] = usePreservedState<number | undefined>('age', undefined)

  return (
    <DynamicContent>
      <DialogHeader>
        <DialogTitle>State Modal Example</DialogTitle>
        <DialogDescription>
          This modal is rendered dynamically when you push it using the pushModal function.
        </DialogDescription>
      </DialogHeader>
      <div className='text-muted-foreground mt-4 min-h-80 text-sm'>
        <div className='flex flex-col gap-7'>
          <FieldSet className='w-full'>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor='username'>Username</FieldLabel>
                <Input
                  id='username'
                  type='text'
                  placeholder='Max Leiter'
                  value={username}
                  onChange={(e) => setName(e.target.value)}
                />
                <FieldDescription>Choose a unique username for your account.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor='email'>Email</FieldLabel>
                <Input
                  id='email'
                  type='email'
                  placeholder='jhondoe@example.cn'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <FieldDescription>Enter a valid email address.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor='age'>Age</FieldLabel>
                <Input
                  id='age'
                  type='number'
                  placeholder='18'
                  value={age ?? ''}
                  onChange={(e) =>
                    setAge(e.target.value ? parseInt(e.target.value, 10) : undefined)
                  }
                />
                <FieldDescription>Enter your age (must be 18 or older).</FieldDescription>
              </Field>
            </FieldGroup>
          </FieldSet>

          <Button
            disabled={!username || !email || !age}
            onClick={() => {
              toast.success('Data sent successfully!', {
                description: (
                  <div className='flex items-center gap-2'>
                    <div>
                      <strong>Username:</strong> {username}
                    </div>
                    <div>
                      <strong>Email:</strong> {email}
                    </div>
                    <div>
                      <strong>Age:</strong> {age}
                    </div>
                  </div>
                ),
              })
            }}
          >
            Send Data
          </Button>
        </div>
      </div>
    </DynamicContent>
  )
}

export { StateModalExample }
`}
          </pre>
        ),
      }}
    />
  )
}

export { CardStateExample }

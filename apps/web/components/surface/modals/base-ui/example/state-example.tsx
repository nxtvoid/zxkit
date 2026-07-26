import { Input } from '@zxkit/ui/input'
import { DialogDescription, DialogHeader, DialogTitle } from '@zxkit/ui/base-ui/dialog'
import { Field, FieldGroup, FieldLabel, FieldSet } from '@zxkit/ui/field'
import { BaseDynamicContent, useBasePreservedState } from '../dynamic'

const BaseStateModalExample = () => {
  const [username, setName] = useBasePreservedState('username', '')
  const [email, setEmail] = useBasePreservedState('email', '')

  return (
    <BaseDynamicContent>
      <DialogHeader>
        <DialogTitle>Base UI responsive modal</DialogTitle>
        <DialogDescription>
          Dialog on desktop, drawer on mobile — both from Base UI.
        </DialogDescription>
      </DialogHeader>
      <div className='text-muted-foreground mt-4 min-h-80 text-sm'>
        <p className='mb-6'>
          Type below, then resize past the breakpoint. The primitives swap and the values survive —
          the same guarantee the Radix example gives, from the same surface API.
        </p>
        <FieldSet className='w-full'>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor='base-username'>Username</FieldLabel>
              <Input
                id='base-username'
                type='text'
                placeholder='janedoe'
                value={username}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor='base-email'>Email</FieldLabel>
              <Input
                id='base-email'
                type='email'
                placeholder='jane@example.com'
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
          </FieldGroup>
        </FieldSet>
      </div>
    </BaseDynamicContent>
  )
}

export { BaseStateModalExample }

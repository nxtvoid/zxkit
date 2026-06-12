'use client'

import { Button } from '@zxkit/ui/button'
import { pushModal } from '@/components/surface/modals'
import { SurfaceExampleCard } from '@/components/surface/example-card'

const CardFormExample = () => {
  return (
    <SurfaceExampleCard
      header={{
        title: 'Persistence with react-hook-form',
        subtitle: 'Forms with validation and automatic persistence.',
        badgeText: 'usePreservedForm',
      }}
      classes={{
        tabCode: 'justify-baseline items-baseline',
      }}
      content={{
        preview: <Button onClick={() => pushModal('FormExample')}>Open form</Button>,
        code: (
          <pre className='bg-muted size-full max-h-108 flex-1 grow overflow-x-auto rounded-md p-4'>
            {`import { z } from 'zod/v3'
import { toast } from 'sonner'
import { Input } from '@zxkit/ui/input'
import { Button } from '@zxkit/ui/button'
import { Textarea } from '@zxkit/ui/textarea'
import { zodResolver } from '@hookform/resolvers/zod'
import { DynamicContent, usePreservedForm } from '../dynamic'
import { DialogDescription, DialogHeader, DialogTitle } from '@zxkit/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@zxkit/ui/form'

const postSchema = z.object({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters long')
    .max(100, 'Title must be at most 100 characters long'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters long')
    .max(500, 'Description must be at most 500 characters long'),
})

type formData = z.infer<typeof postSchema>

const FormModalExample = () => {
  const form = usePreservedForm<formData>('form-example', {
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  })

  function onSubmit(values: formData) {
    console.log('Form submitted with values:', values)

    toast.success('Post created', {
      description: 'Check the console to see the submitted values.',
    })
  }

  return (
    <DynamicContent>
      <DialogHeader>
        <DialogTitle>Preserved form</DialogTitle>
        <DialogDescription>
          A react-hook-form instance that survives the dialog ↔ drawer swap.
        </DialogDescription>
      </DialogHeader>
      <div className='text-muted-foreground mt-4 min-h-80 text-sm'>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder='e.g., My Blog' autoComplete='off' {...field} />
                  </FormControl>
                  <FormDescription>
                    Between 5 and 100 characters.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='e.g., My Blog Description'
                      autoComplete='off'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Between 10 and 500 characters.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type='submit' className='w-full' disabled={!form.formState.isDirty}>
              Create post
            </Button>
          </form>
        </Form>
      </div>
    </DynamicContent>
  )
}

export { FormModalExample }
`}
          </pre>
        ),
      }}
    />
  )
}

export { CardFormExample }

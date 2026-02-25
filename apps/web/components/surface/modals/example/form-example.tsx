import { z } from 'zod/v3'
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

    toast.success('Form submitted successfully!', {
      description: 'Check the console to see the submitted values.',
    })
  }

  return (
    <DynamicContent>
      <DialogHeader>
        <DialogTitle>Form Modal Example</DialogTitle>
        <DialogDescription>
          This modal is rendered dynamically when you push it using the pushModal function.
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
                    The title of your post. Must be between 5 and 100 characters.
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
                    The description of your post. Must be between 10 and 500 characters.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type='submit' className='w-full' disabled={!form.formState.isDirty}>
              Create Post
            </Button>
          </form>
        </Form>
      </div>
    </DynamicContent>
  )
}

export { FormModalExample }

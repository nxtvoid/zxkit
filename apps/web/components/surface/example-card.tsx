import { Badge } from '@zxkit/ui/badge'
import { cn } from '@zxkit/ui/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zxkit/ui/tabs'

type ExampleCardProps = {
  header: {
    title: string
    subtitle: string
    badgeText?: string
  }
  classes?: {
    root?: string
    header?: string
    title?: string
    subtitle?: string
    badge?: string
    tabPreview?: string
    tabCode?: string
  }
  content: {
    preview: React.ReactNode
    code: React.ReactNode
  }
}

const SurfaceExampleCard = ({ classes, header, content }: ExampleCardProps) => {
  return (
    <div className={cn('border-border w-full rounded-lg border', classes?.root)}>
      <Tabs defaultValue='preview' className='w-full gap-0'>
        <div
          className={cn(
            'border-border flex items-center justify-between gap-2 border-b p-3',
            classes?.header
          )}
        >
          <div>
            <div className='flex items-center gap-2'>
              <h3 className={cn('text-sm font-medium', classes?.title)}>{header.title}</h3>
              {header.badgeText && (
                <Badge variant='secondary' className={classes?.badge}>
                  {header.badgeText}
                </Badge>
              )}
            </div>
            <p className={cn('text-muted-foreground text-sm', classes?.subtitle)}>
              {header.subtitle}
            </p>
          </div>

          <TabsList>
            <TabsTrigger value='preview'>Preview</TabsTrigger>
            <TabsTrigger value='code'>Code</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent
          className={cn('flex min-h-52 items-center justify-center p-3', classes?.tabPreview)}
          value='preview'
        >
          {content.preview}
        </TabsContent>
        <TabsContent
          className={cn('flex min-h-52 items-center justify-center p-3', classes?.tabCode)}
          value='code'
        >
          {content.code}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { SurfaceExampleCard }

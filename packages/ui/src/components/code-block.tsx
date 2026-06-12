import { cn } from '@zxkit/ui/lib/utils'
import { CopyButton } from '@zxkit/ui/copy-button'

type CodeBlockProps = {
  code: string
  className?: string
  copyable?: boolean
}

const CodeBlock = ({ code, className, copyable = true }: CodeBlockProps) => {
  return (
    <div className='group relative'>
      <pre
        className={cn(
          'bg-muted/30 min-w-0 flex-1 overflow-x-auto rounded-lg p-4 text-sm leading-relaxed',
          className
        )}
      >
        <code className='text-foreground/90 font-mono text-[13px]'>{code}</code>
      </pre>
      {copyable && (
        <CopyButton
          value={code}
          className='absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100'
        />
      )}
    </div>
  )
}

export { CodeBlock }

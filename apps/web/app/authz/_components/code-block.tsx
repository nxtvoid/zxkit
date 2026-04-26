type CodeBlockProps = {
  code: string
}

export function CodeBlock({ code }: CodeBlockProps) {
  return (
    <pre className='bg-muted/30 min-w-0 flex-1 overflow-x-auto rounded-lg p-4 text-sm leading-relaxed'>
      <code className='text-foreground/90 font-mono text-[13px]'>{code}</code>
    </pre>
  )
}

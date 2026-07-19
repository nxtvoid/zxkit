'use client'

import { cn } from '@zxkit/ui/lib/utils'
import { Button } from '@zxkit/ui/button'
import { InputGroup } from '@zxkit/ui/input-group'
import { PipetteIcon } from 'lucide-react'
import { Field, FieldLabel } from '@zxkit/ui/field'
import { useDebouncedCallback } from 'use-debounce'
import { ButtonGroup, ButtonGroupText } from '@zxkit/ui/button-group'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import { Popover, PopoverContent, PopoverTrigger } from '@zxkit/ui/popover'

type ColorFieldProps = {
  label: string
  color: string
  presets: string[]
  onChange: (color: string) => void
}

const ColorField = ({ label, color, presets, onChange }: ColorFieldProps) => {
  const onColorChange = useDebouncedCallback((color: string) => onChange(color), 500)

  return (
    <Field className='overflow-hidden'>
      <FieldLabel>{label}</FieldLabel>
      <div className='flex items-center gap-3'>
        <ButtonGroup className='border-border max-w-32 flex-1 shrink-0 overflow-hidden rounded-lg border'>
          <Popover>
            <ButtonGroupText className='border-y-0 border-l-0 px-3' asChild>
              <PopoverTrigger className='group cursor-pointer' style={{ backgroundColor: color }}>
                <PipetteIcon className='text-primary-foreground mix-blend-difference transition-transform group-hover:scale-105' />
              </PopoverTrigger>
            </ButtonGroupText>
            <PopoverContent className='w-fit' side='top' align='start' sideOffset={15}>
              <HexColorPicker color={color} onChange={(color) => onColorChange(color)} />
            </PopoverContent>
          </Popover>
          <InputGroup className='max-w-fit border-0'>
            <HexColorInput
              className='h-9 w-full min-w-0 bg-transparent px-2 py-1 text-base shadow-xs outline-none sm:text-sm'
              color={color}
              onChange={(color) => onColorChange(color)}
            />
          </InputGroup>
        </ButtonGroup>
        <div className='flex-1 overflow-x-auto p-1'>
          <div className='flex items-center gap-2'>
            {presets.map((c) => (
              <Button
                key={c}
                style={{ '--preset-color': c } as React.CSSProperties}
                className={cn(
                  'ring-offset-background cursor-pointer ring ring-transparent ring-offset-2',
                  'bg-(--preset-color) hover:bg-(--preset-color) hover:ring-(--preset-color) hover:dark:bg-(--preset-color)',
                  color.toLowerCase() === c.toLowerCase() && 'ring-(--preset-color)'
                )}
                variant='ghost'
                size='icon-sm'
                onClick={() => onChange(c)}
              />
            ))}
          </div>
        </div>
      </div>
    </Field>
  )
}

export { ColorField }

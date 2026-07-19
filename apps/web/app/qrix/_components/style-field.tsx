'use client'

import type { LucideIcon } from 'lucide-react'
import { Button } from '@zxkit/ui/button'
import { ButtonGroup } from '@zxkit/ui/button-group'
import { Field, FieldLabel } from '@zxkit/ui/field'

type StyleOption<T extends string> = {
  value: T
  label: string
  icon: LucideIcon
}

type StyleFieldProps<T extends string> = {
  label: string
  value: T
  options: StyleOption<T>[]
  onChange: (value: T) => void
}

const StyleField = <T extends string>({ label, value, options, onChange }: StyleFieldProps<T>) => {
  return (
    <Field className='w-full'>
      <FieldLabel>{label}</FieldLabel>
      <ButtonGroup className='border-border w-fit overflow-hidden rounded-lg border'>
        {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => (
          <Button
            key={optionValue}
            className='cursor-pointer'
            variant={value === optionValue ? 'default' : 'ghost'}
            size='icon'
            aria-label={optionLabel}
            title={optionLabel}
            onClick={() => onChange(optionValue)}
          >
            <Icon />
          </Button>
        ))}
      </ButtonGroup>
    </Field>
  )
}

export { StyleField, type StyleOption }

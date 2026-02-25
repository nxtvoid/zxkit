'use client'

import { useState } from 'react'
import { cn } from '@zxkit/ui/lib/utils'
import { Input } from '@zxkit/ui/input'
import { Badge } from '@zxkit/ui/badge'
import { Slider } from '@zxkit/ui/slider'
import { Button } from '@zxkit/ui/button'
import { QRCodeSVG } from '@zxkit/qrix'
import { Separator } from '@zxkit/ui/separator'
import { InputGroup } from '@zxkit/ui/input-group'
import { QrActionBar } from './qr-actionbar'
import { PipetteIcon } from 'lucide-react'
import { Field, FieldLabel } from '@zxkit/ui/field'
import { useDebouncedCallback } from 'use-debounce'
import { ButtonGroup, ButtonGroupText } from '@zxkit/ui/button-group'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import { Popover, PopoverContent, PopoverTrigger } from '@zxkit/ui/popover'
import { DEFAULT_COLORS, DEFAULT_LOGO_URL, DEFAULT_URL } from '@/lib/constants'

const QRIXView = () => {
  const [value, setValue] = useState(DEFAULT_URL)
  const [color, setColor] = useState('#262626')
  const [size, setSize] = useState(150)
  const [quietZone, setQuietZone] = useState(1)
  const [logoUrl, setLogoUrl] = useState<string>(DEFAULT_LOGO_URL)
  const [logoSize, setLogoSize] = useState(20)
  const [logoPadding, setLogoPadding] = useState(5)

  const onColorChange = useDebouncedCallback((color: string) => setColor(color), 500)

  const handleReset = () => {
    setValue(DEFAULT_URL)
    setColor('#262626')
    setSize(150)
    setQuietZone(1)
    setLogoUrl(DEFAULT_LOGO_URL)
    setLogoSize(20)
    setLogoPadding(5)
  }

  return (
    <div className='flex flex-col items-center justify-center gap-10 py-10'>
      <div className='grid place-items-center gap-5'>
        <div className='border-border size-fit overflow-hidden rounded-md border'>
          <QRCodeSVG
            value={value}
            size={size}
            fgColor={color}
            logoUrl={logoUrl}
            logoSize={logoSize}
            logoPadding={logoPadding}
            quietZone={quietZone}
          />
        </div>

        <QrActionBar
          qrData={{
            value,
            size,
            fgColor: color,
            quietZone,
            logoUrl,
            logoSize,
            logoPadding,
          }}
          handleReset={handleReset}
        />
      </div>

      <div className='mx-auto grid w-full max-w-md gap-10'>
        <Field className='w-full'>
          <FieldLabel>QR Size {size}px</FieldLabel>
          <Slider
            defaultValue={[size]}
            min={100}
            max={350}
            step={1}
            value={[size]}
            onValueChange={([value]) => setSize(Number(value))}
          />
        </Field>

        <Field className='w-full'>
          <FieldLabel>Quiet Zone {quietZone}%</FieldLabel>
          <Slider
            defaultValue={[quietZone]}
            min={1}
            max={40}
            step={1}
            value={[quietZone]}
            onValueChange={([value]) => setQuietZone(Number(value))}
          />
        </Field>

        <Field className='w-full'>
          <FieldLabel>Link</FieldLabel>
          <Input
            type='text'
            placeholder='Enter URL or text'
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>

        <Field className='w-full'>
          <FieldLabel>Logo URL (Image/SVG)</FieldLabel>
          <Input
            type='text'
            placeholder='Logo URL'
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
        </Field>

        <Field className='w-full'>
          <FieldLabel>Logo Size {logoSize}%</FieldLabel>
          <Slider
            defaultValue={[logoSize]}
            min={5}
            max={30}
            step={1}
            value={[logoSize]}
            onValueChange={([value]) => setLogoSize(Number(value))}
            disabled={!logoUrl}
          />
        </Field>

        <Field className='w-full'>
          <FieldLabel>Logo Padding {logoPadding}px</FieldLabel>
          <Slider
            defaultValue={[logoPadding]}
            min={0}
            max={20}
            step={1}
            value={[logoPadding]}
            onValueChange={([value]) => setLogoPadding(Number(value))}
            disabled={!logoUrl}
          />
        </Field>

        <Field className='overflow-hidden'>
          <FieldLabel>QR Code Color</FieldLabel>
          <div className='flex items-center gap-3'>
            <ButtonGroup className='border-border max-w-32 flex-1 shrink-0 overflow-hidden rounded-lg border'>
              <Popover>
                <ButtonGroupText className='border-y-0 border-l-0 px-3' asChild>
                  <PopoverTrigger
                    className='group cursor-pointer'
                    style={{ backgroundColor: color }}
                  >
                    <PipetteIcon className='text-primary-foreground transition-transform group-hover:scale-105' />
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
                {DEFAULT_COLORS.map((c) => (
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
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
        </Field>

        <Separator />

        <Field className='w-full'>
          <FieldLabel>Other QR Code Options</FieldLabel>
          <div className='grid gap-2 select-none sm:grid-cols-2'>
            <Badge variant='secondary'>bgColor: white</Badge>
            <Badge variant='secondary'>logoBackgroundColor: white</Badge>
            <Badge variant='secondary'>errorCorrectionLevel: M</Badge>
            <Badge variant='secondary'>className: N/A</Badge>
            <Badge variant='secondary'>style: N/A</Badge>
          </div>
        </Field>
      </div>
    </div>
  )
}

export { QRIXView }

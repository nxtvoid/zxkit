'use client'

import { useState } from 'react'
import { Input } from '@zxkit/ui/input'
import { Slider } from '@zxkit/ui/slider'
import {
  QRCodeSVG,
  type DotStyle,
  type MarkerCenterStyle,
  type MarkerBorderStyle,
} from '@zxkit/qrix'
import { QrActionBar } from './qr-actionbar'
import { ColorField } from './color-field'
import { StyleField, type StyleOption } from './style-field'
import { Field, FieldLabel } from '@zxkit/ui/field'
import { Circle, CircleDot, Grid3x3, Grip, Square, SquareSquare, Squircle } from 'lucide-react'
import { DEFAULT_BG_COLORS, DEFAULT_COLORS, DEFAULT_LOGO_URL, DEFAULT_URL } from '@/lib/constants'

const DOT_STYLE_OPTIONS: StyleOption<DotStyle>[] = [
  { value: 'square', label: 'Square', icon: Grid3x3 },
  { value: 'dots', label: 'Dots', icon: Grip },
  { value: 'rounded', label: 'Rounded', icon: Squircle },
]

const MARKER_CENTER_OPTIONS: StyleOption<MarkerCenterStyle>[] = [
  { value: 'square', label: 'Square', icon: SquareSquare },
  { value: 'dot', label: 'Dot', icon: CircleDot },
]

const MARKER_BORDER_OPTIONS: StyleOption<MarkerBorderStyle>[] = [
  { value: 'square', label: 'Square', icon: Square },
  { value: 'rounded', label: 'Rounded', icon: Squircle },
  { value: 'circle', label: 'Circle', icon: Circle },
]

const QRIXView = () => {
  const [value, setValue] = useState(DEFAULT_URL)
  const [color, setColor] = useState('#262626')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [size, setSize] = useState(150)
  const [quietZone, setQuietZone] = useState(1)
  const [logoUrl, setLogoUrl] = useState<string>(DEFAULT_LOGO_URL)
  const [logoSize, setLogoSize] = useState(20)
  const [logoPadding, setLogoPadding] = useState(4)
  const [dotStyle, setDotStyle] = useState<DotStyle>('square')
  const [markerCenterStyle, setMarkerCenterStyle] = useState<MarkerCenterStyle>('square')
  const [markerBorderStyle, setMarkerBorderStyle] = useState<MarkerBorderStyle>('square')

  const handleReset = () => {
    setValue(DEFAULT_URL)
    setColor('#262626')
    setBgColor('#ffffff')
    setSize(150)
    setQuietZone(1)
    setLogoUrl(DEFAULT_LOGO_URL)
    setLogoSize(20)
    setLogoPadding(4)
    setDotStyle('square')
    setMarkerCenterStyle('square')
    setMarkerBorderStyle('square')
  }

  return (
    <div className='flex flex-col items-center justify-center gap-10 py-4'>
      <div className='grid place-items-center gap-5'>
        <div className='border-border size-fit overflow-hidden rounded-md border'>
          <QRCodeSVG
            value={value}
            size={size}
            fgColor={color}
            bgColor={bgColor}
            logoUrl={logoUrl}
            logoSize={logoSize}
            logoPadding={logoPadding}
            logoBackgroundColor={bgColor}
            quietZone={quietZone}
            errorCorrectionLevel='H'
            dotStyle={dotStyle}
            markerCenterStyle={markerCenterStyle}
            markerBorderStyle={markerBorderStyle}
          />
        </div>

        <QrActionBar
          qrData={{
            value,
            size,
            fgColor: color,
            bgColor,
            quietZone,
            logoUrl,
            logoSize,
            logoPadding,
            logoBackgroundColor: bgColor,
            dotStyle,
            markerCenterStyle,
            markerBorderStyle,
          }}
          handleReset={handleReset}
        />
      </div>

      <div className='mx-auto grid w-full max-w-md gap-10'>
        <Field className='w-full'>
          <FieldLabel>Size {size}px</FieldLabel>
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
          <FieldLabel>Content</FieldLabel>
          <Input
            type='text'
            placeholder='URL or text'
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>

        <Field className='w-full'>
          <FieldLabel>Logo URL (image or SVG)</FieldLabel>
          <Input
            type='text'
            placeholder='https://example.com/logo.svg'
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

        <StyleField
          label='Dot style'
          value={dotStyle}
          options={DOT_STYLE_OPTIONS}
          onChange={setDotStyle}
        />

        <div className='grid grid-cols-2 gap-4'>
          <StyleField
            label='Marker center'
            value={markerCenterStyle}
            options={MARKER_CENTER_OPTIONS}
            onChange={setMarkerCenterStyle}
          />

          <StyleField
            label='Marker border'
            value={markerBorderStyle}
            options={MARKER_BORDER_OPTIONS}
            onChange={setMarkerBorderStyle}
          />
        </div>

        <ColorField label='Color' color={color} presets={DEFAULT_COLORS} onChange={setColor} />

        <ColorField
          label='Background'
          color={bgColor}
          presets={DEFAULT_BG_COLORS}
          onChange={setBgColor}
        />
      </div>
    </div>
  )
}

export { QRIXView }

export const renderExample = `import { QRCodeSVG } from '@zxkit/qrix'

<QRCodeSVG
  value='https://example.com'
  size={256}
  fgColor='#262626'
  logoUrl='/logo.svg'
  logoSize={20}
  quietZone={4}
  errorCorrectionLevel='M'
/>`

export const utilitiesExample = `import {
  copyQRCodeToClipboard,
  downloadQRCodePNG,
  downloadQRCodeSVG,
} from '@zxkit/qrix'

await downloadQRCodePNG({ value, size, fgColor, logoUrl })
await downloadQRCodeSVG({ value, size, fgColor, logoUrl })
await copyQRCodeToClipboard({ value, size, fgColor, logoUrl })`

export const features = [
  {
    title: 'SVG-based',
    description: 'Crisp at any size, styleable with className and style like any element.',
  },
  {
    title: 'Logo support',
    description: 'Embed an image or SVG in the center, with size and padding control.',
  },
  {
    title: 'Error correction',
    description: 'Levels L, M, Q, and H — raise it when a logo covers more modules.',
  },
  {
    title: 'Utilities included',
    description: 'Download as PNG or SVG, or copy the QR straight to the clipboard.',
  },
  {
    title: 'Lightweight',
    description: 'Minimal dependencies, React 18 and 19.',
  },
]

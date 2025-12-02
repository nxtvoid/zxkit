<p align="center">
  <img src="./github.png" alt="qrix banner" width="100%" />
</p>

<h1 align="center">@zxkit/qrix</h1>

<p align="center">
  A lightweight React library for generating and rendering QR codes as SVG with logo support.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zxkit/qrix"><img src="https://img.shields.io/npm/v/@zxkit/qrix.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@zxkit/qrix"><img src="https://img.shields.io/npm/dm/@zxkit/qrix.svg" alt="npm downloads" /></a>
  <a href="https://github.com/nxtvoid/zxkit/blob/main/packages/qrix/LICENSE"><img src="https://img.shields.io/npm/l/@zxkit/qrix.svg" alt="license" /></a>
</p>

---

## Features

- 🎨 **SVG-based** - Crisp rendering at any size
- 🖼️ **Logo support** - Embed logos in the center of your QR codes
- 🎯 **Error correction** - Multiple levels (L, M, Q, H)
- 📦 **Lightweight** - Minimal dependencies
- ⚡ **Fast** - Optimized rendering
- 🔧 **Utilities** - Download as PNG, copy to clipboard
- 📱 **React 18/19** - Full compatibility

## Installation

```bash
npm install @zxkit/qrix
# or
yarn add @zxkit/qrix
# or
pnpm add @zxkit/qrix
# or
bun add @zxkit/qrix
```

## Usage

### Basic Example

```tsx
import { QRCodeSVG } from '@zxkit/qrix'

function App() {
  return <QRCodeSVG value='https://example.com' size={256} />
}
```

### With Logo

```tsx
import { QRCodeSVG } from '@zxkit/qrix'

function App() {
  return (
    <QRCodeSVG
      value='https://example.com'
      size={256}
      logoUrl='/logo.png'
      logoSize={20}
      logoPadding={4}
      logoBackgroundColor='#ffffff'
    />
  )
}
```

### Custom Colors

```tsx
import { QRCodeSVG } from '@zxkit/qrix'

function App() {
  return <QRCodeSVG value='https://example.com' size={256} fgColor='#4F46E5' bgColor='#F9FAFB' />
}
```

### Download & Copy Utilities

```tsx
import { QRCodeSVG, downloadQRCodePNG, copyQRCodeToClipboard } from '@zxkit/qrix'

function App() {
  const qrOptions = {
    value: 'https://example.com',
    size: 256,
    fgColor: '#000000',
    bgColor: '#ffffff',
  }

  const handleDownload = async () => {
    await downloadQRCodePNG(qrOptions, 'my-qrcode.png')
  }

  const handleCopy = async () => {
    await copyQRCodeToClipboard(qrOptions)
  }

  return (
    <div>
      <QRCodeSVG {...qrOptions} />
      <button onClick={handleDownload}>Download PNG</button>
      <button onClick={handleCopy}>Copy to Clipboard</button>
    </div>
  )
}
```

## API Reference

### `<QRCodeSVG />`

| Prop                   | Type                       | Default      | Description                      |
| ---------------------- | -------------------------- | ------------ | -------------------------------- |
| `value`                | `string`                   | **required** | Content to encode in the QR code |
| `size`                 | `number`                   | `200`        | Size in pixels                   |
| `fgColor`              | `string`                   | `#000000`    | Foreground color                 |
| `bgColor`              | `string`                   | `#ffffff`    | Background color                 |
| `logoUrl`              | `string`                   | -            | URL of the logo image            |
| `logoSize`             | `number`                   | `20`         | Logo size as percentage (0-100)  |
| `logoPadding`          | `number`                   | `4`          | Logo padding in pixels           |
| `logoBackgroundColor`  | `string`                   | `#ffffff`    | Logo background color            |
| `errorCorrectionLevel` | `'L' \| 'M' \| 'Q' \| 'H'` | `H`          | Error correction level           |
| `quietZone`            | `number`                   | `4`          | Quiet zone size in modules       |
| `className`            | `string`                   | -            | Additional CSS class             |
| `style`                | `CSSProperties`            | -            | Inline styles                    |

### Utility Functions

#### `generateQRCodeSVG(options: QRCodeOptions): Promise<string>`

Generates a QR code as an SVG string.

#### `generateQRCodeDataURL(options: QRCodeOptions): Promise<string>`

Generates a QR code as a data URL.

#### `downloadQRCodePNG(options: QRCodeOptions, filename?: string, scale?: number): Promise<void>`

Downloads the QR code as a PNG file.

#### `copyQRCodeToClipboard(options: QRCodeOptions, scale?: number): Promise<void>`

Copies the QR code to the clipboard as a PNG image.

## Error Correction Levels

| Level | Recovery Capacity | Best For                 |
| ----- | ----------------- | ------------------------ |
| `L`   | ~7%               | Clean environments       |
| `M`   | ~15%              | General use              |
| `Q`   | ~25%              | Industrial               |
| `H`   | ~30%              | With logos (recommended) |

> **Note:** When using a logo, use `H` (High) error correction to ensure the QR code remains scannable.

## License

MIT © [nxtvoid](https://github.com/nxtvoid)

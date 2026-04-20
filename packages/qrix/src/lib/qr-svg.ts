/**
 * QR Code SVG Library
 * Uses proven qrcode library for matrix generation
 * Custom SVG rendering with logo support
 */

import QRCodeLib from 'qrcode'

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

export interface QRCodeOptions {
  value: string
  size?: number
  fgColor?: string
  bgColor?: string
  logoUrl?: string
  logoSize?: number // Percentage of QR size (0-100)
  logoPadding?: number
  logoBackgroundColor?: string
  errorCorrectionLevel?: ErrorCorrectionLevel
  quietZone?: number
}

interface QRMatrix {
  modules: boolean[][]
  size: number
}

interface SanitizedQRCodeOptions {
  value: string
  size: number
  fgColor: string
  bgColor: string
  logoUrl?: string
  logoSize: number
  logoPadding: number
  logoBackgroundColor: string
  errorCorrectionLevel: ErrorCorrectionLevel
  quietZone: number
}

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function encodeToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function createSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${encodeToBase64(svg)}`
}

function sanitizeNumber(
  value: number | undefined,
  fallback: number,
  options: {
    min?: number
    max?: number
    integer?: boolean
  } = {}
): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback
  }

  let nextValue = value

  if (options.integer) {
    nextValue = Math.floor(nextValue)
  }

  if (options.min !== undefined) {
    nextValue = Math.max(options.min, nextValue)
  }

  if (options.max !== undefined) {
    nextValue = Math.min(options.max, nextValue)
  }

  return nextValue
}

function sanitizeOptions(options: QRCodeOptions): SanitizedQRCodeOptions {
  return {
    value: options.value,
    size: sanitizeNumber(options.size, 256, { min: 1, integer: true }),
    fgColor: options.fgColor ?? '#000000',
    bgColor: options.bgColor ?? '#FFFFFF',
    logoUrl: options.logoUrl,
    logoSize: sanitizeNumber(options.logoSize, 20, { min: 0, max: 100 }),
    logoPadding: sanitizeNumber(options.logoPadding, 4, { min: 0 }),
    logoBackgroundColor: options.logoBackgroundColor ?? '#FFFFFF',
    errorCorrectionLevel: options.errorCorrectionLevel ?? 'H',
    quietZone: sanitizeNumber(options.quietZone, 4, { min: 0, integer: true }),
  }
}

/**
 * Generate QR code matrix using qrcode library
 */
async function generateMatrix(
  text: string,
  errorCorrectionLevel: ErrorCorrectionLevel = 'H'
): Promise<QRMatrix> {
  const qr = await QRCodeLib.create(text, {
    errorCorrectionLevel,
  })

  const size = qr.modules.size
  const modules: boolean[][] = []

  for (let y = 0; y < size; y++) {
    const row: boolean[] = []
    for (let x = 0; x < size; x++) {
      row.push(qr.modules.get(x, y) === 1)
    }
    modules.push(row)
  }

  return { modules, size }
}

/**
 * Generate SVG string for QR code
 */
export async function generateQRCodeSVG(options: QRCodeOptions): Promise<string> {
  const {
    value,
    size,
    fgColor,
    bgColor,
    logoUrl,
    logoSize,
    logoPadding,
    logoBackgroundColor,
    errorCorrectionLevel,
    quietZone,
  } = sanitizeOptions(options)

  const matrix = await generateMatrix(value, errorCorrectionLevel)
  const moduleCount = matrix.size
  const totalSize = moduleCount + quietZone * 2
  const moduleSize = size / totalSize

  // Calculate the actual logo dimensions in pixels
  const logoPixelSize = (size * logoSize) / 100
  const logoPaddingPx = logoPadding
  const logoAreaSize = logoPixelSize + logoPaddingPx * 2

  // Calculate which modules fall within the logo area (including padding)
  const logoAreaStart = (size - logoAreaSize) / 2
  const logoAreaEnd = logoAreaStart + logoAreaSize

  // Convert pixel positions to module indices
  const logoModuleStart = Math.floor((logoAreaStart / size) * totalSize) - quietZone
  const logoModuleEnd = Math.ceil((logoAreaEnd / size) * totalSize) - quietZone
  const safeFgColor = escapeXmlAttribute(fgColor)
  const safeBgColor = escapeXmlAttribute(bgColor)
  const safeLogoBackgroundColor = escapeXmlAttribute(logoBackgroundColor)
  const safeLogoUrl = logoUrl ? escapeXmlAttribute(logoUrl) : null

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`

  // Background
  svg += `<rect width="${size}" height="${size}" fill="${safeBgColor}"/>`

  // Build a single path for all modules (optimized SVG)
  let pathData = ''

  for (let y = 0; y < moduleCount; y++) {
    for (let x = 0; x < moduleCount; x++) {
      if (!matrix.modules[y]?.[x]) continue

      // Skip modules in logo area (if logo is provided)
      if (logoUrl) {
        if (
          x >= logoModuleStart &&
          x < logoModuleEnd &&
          y >= logoModuleStart &&
          y < logoModuleEnd
        ) {
          continue
        }
      }

      const px = (x + quietZone) * moduleSize
      const py = (y + quietZone) * moduleSize

      // Add rectangle to path: M(move) x,y h(horizontal) w v(vertical) h h(-w) Z(close)
      pathData += `M${px},${py}h${moduleSize}v${moduleSize}h-${moduleSize}Z`
    }
  }

  // Single path element for all modules
  if (pathData) {
    svg += `<path d="${pathData}" fill="${safeFgColor}"/>`
  }

  // Add logo if provided
  if (safeLogoUrl) {
    const logoX = (size - logoPixelSize) / 2
    const logoY = (size - logoPixelSize) / 2

    // Logo background
    svg += `<rect x="${logoX - logoPadding}" y="${logoY - logoPadding}" width="${logoPixelSize + logoPadding * 2}" height="${logoPixelSize + logoPadding * 2}" fill="${safeLogoBackgroundColor}" rx="4"/>`

    // Logo image
    svg += `<image x="${logoX}" y="${logoY}" width="${logoPixelSize}" height="${logoPixelSize}" href="${safeLogoUrl}" preserveAspectRatio="xMidYMid slice"/>`
  }

  svg += '</svg>'
  return svg
}

/**
 * Convert image URL to base64
 */
async function imageToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch logo: ${response.status}`)
    }

    const contentType = response.headers.get('content-type')
    if (contentType && !contentType.startsWith('image/')) {
      throw new Error(`Invalid logo content type: ${contentType}`)
    }

    const blob = await response.blob()

    if (!blob.type.startsWith('image/')) {
      throw new Error(`Invalid logo blob type: ${blob.type || 'unknown'}`)
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.warn('Failed to convert logo to base64, exporting QR without logo.', error)
    return ''
  }
}

/**
 * Generate SVG with embedded base64 logo (for export)
 */
export async function generateQRCodeSVGForExport(options: QRCodeOptions): Promise<string> {
  if (options.logoUrl) {
    const base64Logo = await imageToBase64(options.logoUrl)
    return generateQRCodeSVG({
      ...options,
      logoUrl: base64Logo || undefined,
    })
  }
  return generateQRCodeSVG(options)
}

/**
 * Generate data URL from SVG
 */
export async function generateQRCodeDataURL(options: QRCodeOptions): Promise<string> {
  const svg = await generateQRCodeSVGForExport(options)
  return createSvgDataUrl(svg)
}

/**
 * Download QR code as PNG
 */
export async function downloadQRCodePNG(
  options: QRCodeOptions,
  filename = 'qrcode.png',
  scale = 4
): Promise<void> {
  const safeScale = sanitizeNumber(scale, 4, { min: 1, integer: true })
  const exportSize = sanitizeOptions(options).size * safeScale
  const svg = await generateQRCodeSVGForExport({
    ...options,
    size: exportSize,
  })

  const canvas = document.createElement('canvas')
  canvas.width = exportSize
  canvas.height = exportSize
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  const img = new Image()
  img.crossOrigin = 'anonymous'

  return new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'))
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        resolve()
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('Failed to load SVG'))
    img.src = createSvgDataUrl(svg)
  })
}

/**
 * Download QR code as SVG
 */
export async function downloadQRCodeSVG(
  options: QRCodeOptions,
  filename = 'qrcode.svg'
): Promise<void> {
  const svg = await generateQRCodeSVGForExport(options)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Copy QR code to clipboard
 */
export async function copyQRCodeToClipboard(options: QRCodeOptions, scale = 4): Promise<void> {
  const safeScale = sanitizeNumber(scale, 4, { min: 1, integer: true })
  const exportSize = sanitizeOptions(options).size * safeScale
  const svg = await generateQRCodeSVGForExport({
    ...options,
    size: exportSize,
  })

  const canvas = document.createElement('canvas')
  canvas.width = exportSize
  canvas.height = exportSize
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  const img = new Image()
  img.crossOrigin = 'anonymous'

  return new Promise((resolve, reject) => {
    img.onload = async () => {
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'))
          return
        }
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          resolve()
        } catch (err) {
          reject(err)
        }
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('Failed to load SVG'))
    img.src = createSvgDataUrl(svg)
  })
}

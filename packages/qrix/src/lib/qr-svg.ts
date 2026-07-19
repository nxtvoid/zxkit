/**
 * QR Code SVG Library
 * Uses proven qrcode library for matrix generation
 * Custom SVG rendering with logo support
 */

import QRCodeLib from 'qrcode'

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'
export type DotStyle = 'square' | 'dots' | 'rounded'
export type MarkerCenterStyle = 'square' | 'dot'
export type MarkerBorderStyle = 'square' | 'rounded' | 'circle'

const DOT_STYLES: readonly DotStyle[] = ['square', 'dots', 'rounded']
const MARKER_CENTER_STYLES: readonly MarkerCenterStyle[] = ['square', 'dot']
const MARKER_BORDER_STYLES: readonly MarkerBorderStyle[] = ['square', 'rounded', 'circle']

// Finder patterns (markers) are 7x7 modules at three corners
const FINDER_SIZE = 7

// Fraction of the symbol each level can recover (ISO/IEC 18004)
const ERROR_CORRECTION_CAPACITY: Record<ErrorCorrectionLevel, number> = {
  L: 0.07,
  M: 0.15,
  Q: 0.25,
  H: 0.3,
}

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
  dotStyle?: DotStyle
  markerCenterStyle?: MarkerCenterStyle
  markerBorderStyle?: MarkerBorderStyle
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
  dotStyle: DotStyle
  markerCenterStyle: MarkerCenterStyle
  markerBorderStyle: MarkerBorderStyle
}

function sanitizeEnum<T extends string>(
  value: T | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  return value !== undefined && allowed.includes(value) ? value : fallback
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
    dotStyle: sanitizeEnum(options.dotStyle, DOT_STYLES, 'square'),
    markerCenterStyle: sanitizeEnum(options.markerCenterStyle, MARKER_CENTER_STYLES, 'square'),
    markerBorderStyle: sanitizeEnum(options.markerBorderStyle, MARKER_BORDER_STYLES, 'square'),
  }
}

/**
 * Generate QR code matrix using qrcode library
 */
function generateMatrix(text: string, errorCorrectionLevel: ErrorCorrectionLevel = 'H'): QRMatrix {
  const qr = QRCodeLib.create(text, {
    errorCorrectionLevel,
  })

  const size = qr.modules.size
  const modules: boolean[][] = []

  for (let y = 0; y < size; y++) {
    const row: boolean[] = []
    for (let x = 0; x < size; x++) {
      row.push(qr.modules.get(y, x) === 1)
    }
    modules.push(row)
  }

  return { modules, size }
}

/**
 * Generate SVG string for QR code
 */
export function generateQRCodeSVG(options: QRCodeOptions): string {
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
    dotStyle,
    markerCenterStyle,
    markerBorderStyle,
  } = sanitizeOptions(options)

  const matrix = generateMatrix(value, errorCorrectionLevel)
  const moduleCount = matrix.size
  const totalSize = moduleCount + quietZone * 2
  const moduleSize = size / totalSize

  // Calculate the actual logo dimensions in pixels
  const logoPixelSize = (size * logoSize) / 100
  const logoPaddingPx = logoPadding
  const logoAreaSize = logoPixelSize + logoPaddingPx * 2

  if (logoUrl) {
    const coverage = (logoAreaSize / size) ** 2
    const capacity = ERROR_CORRECTION_CAPACITY[errorCorrectionLevel]
    if (coverage > capacity) {
      console.warn(
        `[qrix] Logo covers ~${Math.round(coverage * 100)}% of the QR code, more than the ${Math.round(capacity * 100)}% recoverable at error correction level "${errorCorrectionLevel}". The code may not scan; reduce logoSize or raise errorCorrectionLevel.`
      )
    }
  }

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

  const isFinderModule = (x: number, y: number): boolean =>
    (x < FINDER_SIZE && y < FINDER_SIZE) ||
    (x >= moduleCount - FINDER_SIZE && y < FINDER_SIZE) ||
    (x < FINDER_SIZE && y >= moduleCount - FINDER_SIZE)

  const inLogoArea = (x: number, y: number): boolean =>
    logoUrl !== undefined &&
    x >= logoModuleStart &&
    x < logoModuleEnd &&
    y >= logoModuleStart &&
    y < logoModuleEnd

  // Finder patterns are drawn separately as styled markers; data modules skip
  // them along with the logo area
  const isDrawableModule = (x: number, y: number): boolean =>
    x >= 0 &&
    y >= 0 &&
    x < moduleCount &&
    y < moduleCount &&
    matrix.modules[y]?.[x] === true &&
    !isFinderModule(x, y) &&
    !inLogoArea(x, y)

  // Build a single path for all data modules (optimized SVG)
  let pathData = ''

  // Clockwise arcs (sweep flag 1) so overlapping subpaths (circle + bridge
  // rects in the rounded style) union under the nonzero fill rule instead of
  // cancelling each other out
  const circleAt = (cx: number, cy: number, r: number): string =>
    `M${cx - r},${cy}a${r},${r} 0 1,1 ${r * 2},0a${r},${r} 0 1,1 ${-r * 2},0Z`

  for (let y = 0; y < moduleCount; y++) {
    for (let x = 0; x < moduleCount; x++) {
      if (!isDrawableModule(x, y)) continue

      const px = (x + quietZone) * moduleSize
      const py = (y + quietZone) * moduleSize

      if (dotStyle === 'dots') {
        // Isolated dot per module, slightly smaller than the cell
        pathData += circleAt(px + moduleSize / 2, py + moduleSize / 2, moduleSize * 0.4)
      } else if (dotStyle === 'rounded') {
        // Circle per module plus bridges towards dark right/bottom neighbors,
        // so contiguous runs merge into rounded strokes
        pathData += circleAt(px + moduleSize / 2, py + moduleSize / 2, moduleSize / 2)
        if (isDrawableModule(x + 1, y)) {
          pathData += `M${px + moduleSize / 2},${py}h${moduleSize}v${moduleSize}h-${moduleSize}Z`
        }
        if (isDrawableModule(x, y + 1)) {
          pathData += `M${px},${py + moduleSize / 2}h${moduleSize}v${moduleSize}h-${moduleSize}Z`
        }
      } else {
        // Add rectangle to path: M(move) x,y h(horizontal) w v(vertical) h h(-w) Z(close)
        pathData += `M${px},${py}h${moduleSize}v${moduleSize}h-${moduleSize}Z`
      }
    }
  }

  // Single path element for all data modules
  if (pathData) {
    svg += `<path d="${pathData}" fill="${safeFgColor}"/>`
  }

  // Finder pattern markers: 1-module-thick 7x7 border ring + 3x3 center
  const markerOrigins: Array<[number, number]> = [
    [0, 0],
    [moduleCount - FINDER_SIZE, 0],
    [0, moduleCount - FINDER_SIZE],
  ]

  for (const [mx, my] of markerOrigins) {
    const ox = (mx + quietZone) * moduleSize
    const oy = (my + quietZone) * moduleSize
    const centerX = ox + 3.5 * moduleSize
    const centerY = oy + 3.5 * moduleSize

    if (markerBorderStyle === 'circle') {
      svg += `<circle cx="${centerX}" cy="${centerY}" r="${3 * moduleSize}" fill="none" stroke="${safeFgColor}" stroke-width="${moduleSize}"/>`
    } else {
      const borderRadius = markerBorderStyle === 'rounded' ? 2 * moduleSize : 0
      svg += `<rect x="${ox + 0.5 * moduleSize}" y="${oy + 0.5 * moduleSize}" width="${6 * moduleSize}" height="${6 * moduleSize}" fill="none" stroke="${safeFgColor}" stroke-width="${moduleSize}"${borderRadius ? ` rx="${borderRadius}"` : ''}/>`
    }

    if (markerCenterStyle === 'dot') {
      svg += `<circle cx="${centerX}" cy="${centerY}" r="${1.5 * moduleSize}" fill="${safeFgColor}"/>`
    } else {
      svg += `<rect x="${ox + 2 * moduleSize}" y="${oy + 2 * moduleSize}" width="${3 * moduleSize}" height="${3 * moduleSize}" fill="${safeFgColor}"/>`
    }
  }

  // Add logo if provided
  if (safeLogoUrl) {
    const logoX = (size - logoPixelSize) / 2
    const logoY = (size - logoPixelSize) / 2
    // Corner radius proportional to size (4px at the default 256) so exports
    // rendered at a larger size keep the same look
    const logoRadius = size / 64

    // Logo background
    svg += `<rect x="${logoX - logoPadding}" y="${logoY - logoPadding}" width="${logoPixelSize + logoPadding * 2}" height="${logoPixelSize + logoPadding * 2}" fill="${safeLogoBackgroundColor}" rx="${logoRadius}"/>`

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
 * Render QR code to a PNG blob at `size * scale` resolution.
 * Pixel-based logo options are scaled along with the size so the export
 * keeps the same proportions as the on-screen render.
 */
async function renderQRCodePNGBlob(options: QRCodeOptions, scale: number): Promise<Blob> {
  const safeScale = sanitizeNumber(scale, 4, { min: 1, integer: true })
  const sanitized = sanitizeOptions(options)
  const exportSize = sanitized.size * safeScale
  const svg = await generateQRCodeSVGForExport({
    ...options,
    size: exportSize,
    logoPadding: sanitized.logoPadding * safeScale,
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
        resolve(blob)
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('Failed to load SVG'))
    img.src = createSvgDataUrl(svg)
  })
}

/**
 * Download QR code as PNG
 */
export async function downloadQRCodePNG(
  options: QRCodeOptions,
  filename = 'qrcode.png',
  scale = 4
): Promise<void> {
  const blob = await renderQRCodePNGBlob(options, scale)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
  const blob = await renderQRCodePNGBlob(options, scale)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

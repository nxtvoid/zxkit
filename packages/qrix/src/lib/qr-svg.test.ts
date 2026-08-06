import { Resvg } from '@resvg/resvg-js'
import QRCodeLib from 'qrcode'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readBarcodes } from 'zxing-wasm/reader'

import { generateQRCodeDataURL, generateQRCodeSVG, generateQRCodeSVGForExport } from './qr-svg'

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Extract the dark-module coordinates from an SVG generated with
 * size = moduleCount and quietZone = 0, where each module is exactly 1px
 * and path coordinates map directly to (col, row) indices.
 */
function extractDarkModules(svg: string): Set<string> {
  const pathMatch = /<path d="([^"]*)"/.exec(svg)
  expect(pathMatch).not.toBeNull()
  return new Set(
    [...pathMatch![1]!.matchAll(/M([\d.]+),([\d.]+)/g)].map((match) => `${match[1]},${match[2]}`)
  )
}

const FINDER_SIZE = 7

/** True when (col, row) falls inside one of the three 7x7 finder patterns */
function isFinderModule(col: number, row: number, moduleCount: number): boolean {
  return (
    (col < FINDER_SIZE && row < FINDER_SIZE) ||
    (col >= moduleCount - FINDER_SIZE && row < FINDER_SIZE) ||
    (col < FINDER_SIZE && row >= moduleCount - FINDER_SIZE)
  )
}

/**
 * True when (col, row) is a dark module of the spec-defined finder pattern
 * (7x7 outer ring + 3x3 center) whose origin is at (ox, oy).
 */
function isDarkFinderModule(col: number, row: number, ox: number, oy: number): boolean {
  const dx = col - ox
  const dy = row - oy
  if (dx < 0 || dy < 0 || dx >= FINDER_SIZE || dy >= FINDER_SIZE) return false
  const chebyshev = Math.max(Math.abs(dx - 3), Math.abs(dy - 3))
  return chebyshev === 3 || chebyshev <= 1
}

/**
 * Rasterize the module matrix to RGBA pixels (with quiet zone) so an
 * independent decoder can read it without a browser canvas. Finder patterns
 * are painted from the spec since the SVG renders them as separate marker
 * elements, not path modules.
 */
function rasterizeModules(darkModules: Set<string>, moduleCount: number, scale = 4, quiet = 4) {
  const dim = (moduleCount + quiet * 2) * scale
  const rgba = new Uint8ClampedArray(dim * dim * 4).fill(255)

  const finderOrigins: Array<[number, number]> = [
    [0, 0],
    [moduleCount - FINDER_SIZE, 0],
    [0, moduleCount - FINDER_SIZE],
  ]

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      const darkFinder = finderOrigins.some(([ox, oy]) => isDarkFinderModule(col, row, ox, oy))
      if (!darkFinder && !darkModules.has(`${col},${row}`)) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = (col + quiet) * scale + dx
          const py = (row + quiet) * scale + dy
          const offset = (py * dim + px) * 4
          rgba[offset] = 0
          rgba[offset + 1] = 0
          rgba[offset + 2] = 0
        }
      }
    }
  }

  return { rgba, dim }
}

/** Decode QR pixels with zxing (the decoder family real-world scanners use) */
async function decodeImage(
  data: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number
): Promise<string | undefined> {
  const results = await readBarcodes(
    { data, width, height, colorSpace: 'srgb' },
    {
      formats: ['QRCode'],
    }
  )
  return results[0]?.text
}

/**
 * Render the SVG with a real SVG engine (resvg) and decode the resulting
 * pixels. This exercises actual rasterization semantics (fill rules,
 * winding, strokes) that string-level assertions cannot catch.
 */
async function renderAndDecode(svg: string): Promise<string | undefined> {
  const image = new Resvg(svg).render()
  return decodeImage(new Uint8ClampedArray(image.pixels), image.width, image.height)
}

describe('generateQRCodeSVG', () => {
  it('returns the SVG synchronously', () => {
    const svg = generateQRCodeSVG({ value: 'hello' })

    expect(typeof svg).toBe('string')
    expect(svg.startsWith('<svg')).toBe(true)
  })

  it('escapes dynamic SVG attributes', async () => {
    const svg = generateQRCodeSVG({
      value: 'hello',
      fgColor: '" /><script>alert(1)</script>',
      bgColor: '#fff" data-bad="1',
      logoBackgroundColor: '#000" /><g>',
      logoUrl: 'https://example.com/logo.png" /><script>alert(1)</script>',
    })

    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&quot;')
    expect(svg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(svg).toContain('data-bad=&quot;1')
  })

  it('sanitizes invalid numeric options', async () => {
    const svg = generateQRCodeSVG({
      value: 'hello',
      size: Number.NaN,
      quietZone: -4,
      logoSize: 999,
      logoPadding: -20,
    })

    expect(svg).toContain('viewBox="0 0 256 256"')
    expect(svg).toContain('width="256"')
    expect(svg).not.toContain('NaN')
    expect(svg).not.toContain('Infinity')
  })

  it('renders modules in the same orientation as the qrcode matrix', async () => {
    const value = 'hello'
    const qr = QRCodeLib.create(value, { errorCorrectionLevel: 'H' })
    const moduleCount = qr.modules.size

    // size = moduleCount and quietZone = 0 makes each module exactly 1px,
    // so path coordinates map directly to (col, row) indices
    const svg = generateQRCodeSVG({
      value,
      size: moduleCount,
      quietZone: 0,
      errorCorrectionLevel: 'H',
    })

    const darkModules = extractDarkModules(svg)

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        // Finder patterns are rendered as separate marker elements, never in the path
        const expected = isFinderModule(col, row, moduleCount)
          ? false
          : qr.modules.get(row, col) === 1
        expect(darkModules.has(`${col},${row}`)).toBe(expected)
      }
    }
  })

  it.each(['hello', 'https://example.com/path?q=1', 'hola 👋 desde qrix'])(
    'produces a QR that an independent decoder reads back: %s',
    async (value) => {
      const moduleCount = QRCodeLib.create(value, { errorCorrectionLevel: 'H' }).modules.size
      const svg = generateQRCodeSVG({
        value,
        size: moduleCount,
        quietZone: 0,
        errorCorrectionLevel: 'H',
      })

      const { rgba, dim } = rasterizeModules(extractDarkModules(svg), moduleCount)
      const decoded = await decodeImage(rgba, dim, dim)

      expect(decoded).toBe(value)
    }
  )

  it('warns when the logo area exceeds the error correction capacity', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    generateQRCodeSVG({
      value: 'hello',
      logoUrl: 'https://example.com/logo.png',
      logoSize: 40,
      errorCorrectionLevel: 'L',
    })
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0]![0]).toContain('error correction level "L"')

    warnSpy.mockClear()

    generateQRCodeSVG({
      value: 'hello',
      logoUrl: 'https://example.com/logo.png',
      logoSize: 20,
      errorCorrectionLevel: 'H',
    })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('renders three finder markers with default square styles', () => {
    const svg = generateQRCodeSVG({ value: 'hello' })

    const borderRects = svg.match(/<rect [^>]*fill="none" stroke="#000000"/g)
    expect(borderRects).toHaveLength(3)
    expect(svg).not.toContain('rx="0"')

    const centerRects = svg.match(/<rect [^>]*width="([\d.]+)" height="\1" fill="#000000"\/>/g)
    expect(centerRects).toHaveLength(3)
  })

  it('renders dots and rounded dot styles as arc paths', () => {
    const square = generateQRCodeSVG({ value: 'hello' })
    const dots = generateQRCodeSVG({ value: 'hello', dotStyle: 'dots' })
    const rounded = generateQRCodeSVG({ value: 'hello', dotStyle: 'rounded' })

    const pathOf = (svg: string) => /<path d="([^"]*)"/.exec(svg)![1]!

    expect(pathOf(square)).not.toContain('a')
    expect(pathOf(dots)).toContain('a')
    expect(pathOf(rounded)).toContain('a')
    // Rounded merges neighbors with bridge rects, so it mixes arcs and rects
    expect(pathOf(rounded)).toContain('h')
    // Isolated dots never emit bridge rects
    expect(pathOf(dots)).not.toContain('h')
    // Arcs must wind clockwise (sweep flag 1) like the bridge rects, otherwise
    // overlaps cancel under the nonzero fill rule and punch holes
    expect(pathOf(rounded)).not.toContain('1,0 ')
    expect(pathOf(dots)).not.toContain('1,0 ')
  })

  it('renders styled markers', () => {
    const svg = generateQRCodeSVG({
      value: 'hello',
      markerBorderStyle: 'circle',
      markerCenterStyle: 'dot',
    })

    const borderCircles = svg.match(/<circle [^>]*fill="none" stroke="#000000"/g)
    expect(borderCircles).toHaveLength(3)

    const centerDots = svg.match(/<circle [^>]*fill="#000000"\/>/g)
    expect(centerDots).toHaveLength(3)

    const rounded = generateQRCodeSVG({ value: 'hello', markerBorderStyle: 'rounded' })
    const roundedBorders = rounded.match(/<rect [^>]*fill="none"[^>]* rx="[\d.]+"\/>/g)
    expect(roundedBorders).toHaveLength(3)
  })

  describe('rasterized decoding of every style combination', () => {
    const dotStyles = ['square', 'dots', 'rounded'] as const
    const markerCenterStyles = ['square', 'dot'] as const
    const markerBorderStyles = ['square', 'rounded', 'circle'] as const

    const combinations = dotStyles.flatMap((dotStyle) =>
      markerCenterStyles.flatMap((markerCenterStyle) =>
        markerBorderStyles.map((markerBorderStyle) => ({
          dotStyle,
          markerCenterStyle,
          markerBorderStyle,
        }))
      )
    )

    // Each case rasterizes a 400px SVG and decodes it back, which is the most
    // expensive thing this suite does. Alone it takes a fraction of the default
    // 5s; sharing a machine with the other packages' suites it does not, and a
    // timeout there says nothing about the code under test.
    it.each(combinations)(
      'decodes dotStyle=$dotStyle markerCenter=$markerCenterStyle markerBorder=$markerBorderStyle',
      async (styles) => {
        const value = 'https://example.com/styled'
        const svg = generateQRCodeSVG({ value, size: 400, ...styles })

        expect(await renderAndDecode(svg)).toBe(value)
      },
      30_000
    )
  })

  it('renders the logo image and clears the modules underneath', () => {
    const withLogo = generateQRCodeSVG({ value: 'hello', logoUrl: 'https://example.com/l.png' })
    const withoutLogo = generateQRCodeSVG({ value: 'hello' })

    expect(withLogo).toContain('<image ')
    expect(withLogo).toContain('href="https://example.com/l.png"')

    const moduleCountOf = (svg: string) => /<path d="([^"]*)"/.exec(svg)![1]!.match(/M/g)!.length
    expect(moduleCountOf(withLogo)).toBeLessThan(moduleCountOf(withoutLogo))
  })

  it('still decodes with an embedded logo covering the center', async () => {
    // 1x1 png as data URI so resvg can rasterize it without network access
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const value = 'https://example.com/with-logo'
    const svg = generateQRCodeSVG({ value, size: 400, logoUrl: tinyPng, logoSize: 20 })

    expect(await renderAndDecode(svg)).toBe(value)
  })

  it('falls back to square styles on invalid style values', () => {
    const svg = generateQRCodeSVG({
      value: 'hello',
      // @ts-expect-error - runtime validation of unknown style values
      dotStyle: 'banana',
      // @ts-expect-error - runtime validation of unknown style values
      markerBorderStyle: 'banana',
    })

    expect(/<path d="([^"]*)"/.exec(svg)![1]!).not.toContain('a')
    expect(svg.match(/<rect [^>]*fill="none" stroke="#000000"/g)).toHaveLength(3)
  })

  it('scales the logo background corner radius with the size', async () => {
    const options = {
      value: 'hello',
      logoUrl: 'https://example.com/logo.png',
    }

    const base = generateQRCodeSVG({ ...options, size: 256 })
    const scaled = generateQRCodeSVG({ ...options, size: 1024 })

    expect(base).toContain('rx="4"')
    expect(scaled).toContain('rx="16"')
  })
})

describe('generateQRCodeDataURL', () => {
  it('encodes unicode-safe SVG data urls', async () => {
    const dataUrl = await generateQRCodeDataURL({
      value: 'hola 👋 desde qrix',
    })

    expect(dataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true)

    const base64 = dataUrl.slice('data:image/svg+xml;base64,'.length)
    const decoded = Buffer.from(base64, 'base64').toString('utf-8')

    expect(decoded).toContain('<svg')
    expect(decoded).not.toContain('NaN')
  })
})

describe('generateQRCodeSVGForExport', () => {
  it('omits the logo when the remote asset cannot be fetched', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
    } as Response)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const svg = await generateQRCodeSVGForExport({
      value: 'hello',
      logoUrl: 'https://example.com/missing-logo.png',
    })

    expect(svg).not.toContain('<image ')
    expect(warnSpy).toHaveBeenCalledOnce()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateQRCodeDataURL, generateQRCodeSVG, generateQRCodeSVGForExport } from './qr-svg'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('generateQRCodeSVG', () => {
  it('escapes dynamic SVG attributes', async () => {
    const svg = await generateQRCodeSVG({
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
    const svg = await generateQRCodeSVG({
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

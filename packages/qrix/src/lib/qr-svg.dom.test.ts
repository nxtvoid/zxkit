// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { downloadQRCodeSVG, generateQRCodeSVGForExport } from './qr-svg'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('generateQRCodeSVGForExport', () => {
  it('embeds the fetched logo as a base64 data URI', async () => {
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        blob: async () => new Blob([pngBytes], { type: 'image/png' }),
      })
    )

    const svg = await generateQRCodeSVGForExport({
      value: 'hello',
      logoUrl: 'https://example.com/logo.png',
    })

    expect(fetch).toHaveBeenCalledWith('https://example.com/logo.png')
    expect(svg).toContain('href="data:image/png;base64,')
    expect(svg).not.toContain('href="https://example.com/logo.png"')
  })

  it('omits the logo when the response is not an image', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        blob: async () => new Blob(['<html/>'], { type: 'text/html' }),
      })
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const svg = await generateQRCodeSVGForExport({
      value: 'hello',
      logoUrl: 'https://example.com/not-an-image',
    })

    expect(svg).not.toContain('<image ')
    expect(warnSpy).toHaveBeenCalledOnce()
  })
})

describe('downloadQRCodeSVG', () => {
  it('triggers an anchor download with the SVG blob and filename', async () => {
    let capturedBlob: Blob | undefined
    const createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob
      return 'blob:mock-url'
    })
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const originalCreateElement = document.createElement.bind(document)
    let createdAnchor: HTMLAnchorElement | undefined
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName === 'a') createdAnchor = element as HTMLAnchorElement
      return element
    })

    await downloadQRCodeSVG({ value: 'hello' }, 'my-qr.svg')

    expect(capturedBlob?.type).toBe('image/svg+xml')
    expect(await capturedBlob?.text()).toContain('<svg')
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(createdAnchor?.download).toBe('my-qr.svg')
    expect(createdAnchor?.href).toBe('blob:mock-url')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})

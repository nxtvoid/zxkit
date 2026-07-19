// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { QRCodeSVG } from './factory'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Longer than any QR version can hold, so generation throws
const OVERSIZED_VALUE = 'x'.repeat(5000)

describe('QRCodeSVG', () => {
  it('renders the QR code as inline SVG', () => {
    const { container } = render(<QRCodeSVG value='hello' size={100} />)

    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('width')).toBe('100')
  })

  it('renders an empty placeholder when value is empty', () => {
    const { container } = render(<QRCodeSVG value='' size={100} />)

    expect(container.querySelector('svg')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('re-renders when the value changes', () => {
    const { container, rerender } = render(<QRCodeSVG value='hello' />)
    const first = container.innerHTML

    rerender(<QRCodeSVG value='goodbye' />)
    expect(container.innerHTML).not.toBe(first)
  })

  it('shows the default error label when generation fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<QRCodeSVG value={OVERSIZED_VALUE} />)
    expect(screen.getByText('Invalid QR')).toBeTruthy()
  })

  it('shows a custom errorFallback when generation fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<QRCodeSVG value={OVERSIZED_VALUE} errorFallback={<span>QR inválido</span>} />)
    expect(screen.getByText('QR inválido')).toBeTruthy()
    expect(screen.queryByText('Invalid QR')).toBeNull()
  })

  it('includes the SVG in server-side rendered output', () => {
    const html = renderToString(<QRCodeSVG value='hello' />)

    expect(html).toContain('<svg')
  })
})

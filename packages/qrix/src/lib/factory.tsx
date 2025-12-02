'use client'

import type React from 'react'
import { useEffect, useState } from 'react'
import {
  generateQRCodeSVG,
  downloadQRCodePNG,
  downloadQRCodeSVG,
  copyQRCodeToClipboard,
  type QRCodeOptions,
  type ErrorCorrectionLevel,
} from './qr-svg'

export interface QRCodeSVGProps {
  /** Content to encode */
  value: string
  /** Size in pixels */
  size?: number
  /** Foreground color */
  fgColor?: string
  /** Background color */
  bgColor?: string
  /** Logo URL */
  logoUrl?: string
  /** Logo size as percentage (0-100) */
  logoSize?: number
  /** Logo padding in pixels */
  logoPadding?: number
  /** Logo background color */
  logoBackgroundColor?: string
  /** Error correction level */
  errorCorrectionLevel?: ErrorCorrectionLevel
  /** Quiet zone size in modules */
  quietZone?: number
  /** Additional CSS class */
  className?: string
  /** Inline styles */
  style?: React.CSSProperties
}

/**
 * React component for rendering QR codes as SVG
 */
export function QRCodeSVG({
  value,
  size = 200,
  fgColor = '#000000',
  bgColor = '#ffffff',
  logoUrl,
  logoSize = 20,
  logoPadding = 4,
  logoBackgroundColor = '#ffffff',
  errorCorrectionLevel = 'H',
  quietZone = 4,
  className,
  style,
}: QRCodeSVGProps) {
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [error, setError] = useState<boolean>(false)

  useEffect(() => {
    if (!value) {
      setSvgContent(null)
      return
    }

    let cancelled = false

    generateQRCodeSVG({
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
    })
      .then((svg) => {
        if (!cancelled) {
          setSvgContent(svg)
          setError(false)
        }
      })
      .catch((err) => {
        console.error('QR Code generation error:', err)

        if (!cancelled) {
          setError(true)
          setSvgContent(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
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
  ])

  if (error || !svgContent) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bgColor,
          ...style,
        }}
      >
        {error && <span style={{ color: fgColor, fontSize: 12 }}>Invalid QR</span>}
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{ width: size, height: size, ...style }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled SVG content
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}

// Re-export utilities for convenience
export { generateQRCodeSVG, downloadQRCodePNG, downloadQRCodeSVG, copyQRCodeToClipboard }
export type { QRCodeOptions, ErrorCorrectionLevel }

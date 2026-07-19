'use client'

import type React from 'react'
import { useMemo } from 'react'
import {
  generateQRCodeSVG,
  downloadQRCodePNG,
  downloadQRCodeSVG,
  copyQRCodeToClipboard,
  type QRCodeOptions,
  type ErrorCorrectionLevel,
  type DotStyle,
  type MarkerCenterStyle,
  type MarkerBorderStyle,
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
  /** Data module shape */
  dotStyle?: DotStyle
  /** Finder pattern center shape */
  markerCenterStyle?: MarkerCenterStyle
  /** Finder pattern border shape */
  markerBorderStyle?: MarkerBorderStyle
  /** Additional CSS class */
  className?: string
  /** Inline styles */
  style?: React.CSSProperties
  /** Rendered instead of the default "Invalid QR" text when generation fails */
  errorFallback?: React.ReactNode
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
  dotStyle = 'square',
  markerCenterStyle = 'square',
  markerBorderStyle = 'square',
  className,
  style,
  errorFallback,
}: QRCodeSVGProps) {
  const { svgContent, error } = useMemo(() => {
    if (!value) {
      return { svgContent: null, error: false }
    }

    try {
      const svg = generateQRCodeSVG({
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
      })
      return { svgContent: svg, error: false }
    } catch (err) {
      console.error('QR Code generation error:', err)
      return { svgContent: null, error: true }
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
    dotStyle,
    markerCenterStyle,
    markerBorderStyle,
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
        {error &&
          (errorFallback ?? <span style={{ color: fgColor, fontSize: 12 }}>Invalid QR</span>)}
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
export type { QRCodeOptions, ErrorCorrectionLevel, DotStyle, MarkerCenterStyle, MarkerBorderStyle }

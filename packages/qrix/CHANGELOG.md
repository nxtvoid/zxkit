# Changelog

## 2.0.0

### Major Changes

- 715e5cf: Fix transposed QR matrix rendering and make `generateQRCodeSVG` synchronous.

  **Breaking:** `generateQRCodeSVG(options)` now returns `string` instead of `Promise<string>`. Callers using `.then()` must drop it; `await` keeps working. `generateQRCodeSVGForExport`, `generateQRCodeDataURL`, `downloadQRCodePNG`, `downloadQRCodeSVG` and `copyQRCodeToClipboard` remain async.

  **Breaking:** the package is now ESM-only (`.mjs`); the CommonJS build was removed. Only the SVG generation utilities are server-safe now that `'use client'` is scoped to the React component module instead of the whole bundle.

  Fixes and improvements:
  - Fixed matrix access order (`get(row, col)`) — previous versions rendered QR codes mirrored along the diagonal; most readers auto-corrected but strict scanners could fail.
  - `QRCodeSVG` now renders synchronously via `useMemo` (no initial empty flash, SVG present in SSR output).
  - New `errorFallback` prop on `QRCodeSVG` to replace the default "Invalid QR" label.
  - PNG export/clipboard now scale `logoPadding` and the logo background corner radius with the export scale, matching the on-screen proportions.
  - `console.warn` when the logo area exceeds the error correction level's recovery capacity.
  - New style options: `dotStyle` (`'square' | 'dots' | 'rounded'`) for data modules, and `markerCenterStyle` / `markerBorderStyle` for finder patterns. Finder patterns are now rendered as dedicated marker elements instead of plain modules; default output is visually unchanged.

## 1.0.2

### Patch Changes

- Improve QR code SVG safety, input sanitization, and package build output.

## 1.0.1

### Patch Changes

- Update readme banner

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-02

### Added

- Initial release of `@zxkit/qrix`
- `QRCodeSVG` React component for rendering QR codes
- SVG-based rendering for crisp display at any size
- Logo support with customizable size, padding, and background
- Error correction levels: L, M, Q, H
- Customizable foreground and background colors
- Quiet zone configuration
- Utility functions:
  - `generateQRCodeSVG` - Generate QR code as SVG string
  - `generateQRCodeDataURL` - Generate QR code as data URL
  - `generateQRCodeSVGForExport` - Generate SVG with embedded base64 logo
  - `downloadQRCodePNG` - Download QR code as PNG file
  - `copyQRCodeToClipboard` - Copy QR code to clipboard
- Full TypeScript support with exported types
- Dual ESM/CJS module support
- React 18 and 19 compatibility

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-01

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

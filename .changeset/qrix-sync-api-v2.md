---
'@zxkit/qrix': major
---

Fix transposed QR matrix rendering and make `generateQRCodeSVG` synchronous.

**Breaking:** `generateQRCodeSVG(options)` now returns `string` instead of `Promise<string>`. Callers using `.then()` must drop it; `await` keeps working. `generateQRCodeSVGForExport`, `generateQRCodeDataURL`, `downloadQRCodePNG`, `downloadQRCodeSVG` and `copyQRCodeToClipboard` remain async.

**Breaking:** the package is now ESM-only (`.mjs`); the CommonJS build was removed. Only the SVG generation utilities are server-safe now that `'use client'` is scoped to the React component module instead of the whole bundle.

Fixes and improvements:

- Fixed matrix access order (`get(row, col)`) — previous versions rendered QR codes mirrored along the diagonal; most readers auto-corrected but strict scanners could fail.
- `QRCodeSVG` now renders synchronously via `useMemo` (no initial empty flash, SVG present in SSR output).
- New `errorFallback` prop on `QRCodeSVG` to replace the default "Invalid QR" label.
- PNG export/clipboard now scale `logoPadding` and the logo background corner radius with the export scale, matching the on-screen proportions.
- `console.warn` when the logo area exceeds the error correction level's recovery capacity.
- New style options: `dotStyle` (`'square' | 'dots' | 'rounded'`) for data modules, and `markerCenterStyle` / `markerBorderStyle` for finder patterns. Finder patterns are now rendered as dedicated marker elements instead of plain modules; default output is visually unchanged.

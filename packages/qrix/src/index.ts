export { QRCodeSVG } from './lib/factory'
export type { QRCodeSVGProps } from './lib/factory'
export {
  generateQRCodeSVG,
  generateQRCodeDataURL,
  generateQRCodeSVGForExport,
  downloadQRCodePNG,
  downloadQRCodeSVG,
  copyQRCodeToClipboard,
} from './lib/qr-svg'
export type {
  QRCodeOptions,
  ErrorCorrectionLevel,
  DotStyle,
  MarkerCenterStyle,
  MarkerBorderStyle,
} from './lib/qr-svg'

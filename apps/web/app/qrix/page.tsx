import type { Metadata } from 'next'
import { QRIXView } from './_components/qrix-view'

export const metadata: Metadata = {
  title: 'qrix',
  description: 'Generate beautiful QR codes with ease using QRIX from ZXKit.',
}

export default function QrixPage() {
  return <QRIXView />
}

import type { Metadata } from 'next'
import { ChronoView } from './_components/chrono-view'

export const metadata: Metadata = {
  title: '@zxkit/chrono',
  description:
    'Zero-dependency calendar dates and timezone-aware instants with a total API that never throws.',
}

export default function ChronoPage() {
  return <ChronoView />
}

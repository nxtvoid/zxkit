import type { Metadata } from 'next'
import { NotiView } from './_components/noti-view'

export const metadata: Metadata = {
  title: '@zxkit/noti',
  description:
    'React notifications with an imperative API, a store that does not depend on React, and timers that pause for every reason at once.',
}

export default function NotiPage() {
  return <NotiView />
}

'use client'

import { Themes } from '@/types'
import { useTheme } from 'next-themes'
import { NotiOutlet } from '@zxkit/noti'
import { CircleXIcon } from 'lucide-react'

export default function NotiLayout({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, theme } = useTheme()

  return (
    <>
      {children}

      <NotiOutlet
        position='bottom-right'
        theme={(resolvedTheme ?? theme) as Themes}
        icons={{
          error: <CircleXIcon />,
        }}
      />
    </>
  )
}

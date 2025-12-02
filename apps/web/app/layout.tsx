import type { Metadata } from 'next'
import { cn } from '@workspace/ui/lib/utils'
import { Header } from '@/components/header'
import { Providers } from '@/components/providers'
import { Analytics } from '@vercel/analytics/next'
import { siteConfig } from '@/lib/config'
import { Geist, Geist_Mono } from 'next/font/google'

import '@workspace/ui/globals.css'

const fontSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
})

const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL!),
  description: siteConfig.description,
  keywords: [
    'zxkit',
    'qr code',
    'qr code generator',
    'react',
    'next.js',
    'typescript',
    'open source',
    'web tools',
    'utilities',
    'svg',
    'qrix',
  ],
  authors: [
    {
      name: 'nxtvoid',
      url: 'https://github.com/nxtvoid',
    },
  ],
  creator: 'nxtvoid',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL!,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/og.png`,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteConfig.description,
    images: [`${process.env.NEXT_PUBLIC_APP_URL}/og.png`],
    creator: '@nxtvoid',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={cn('min-h-screen font-sans antialiased', fontSans.variable, fontMono.variable)}
      >
        <main className='flex min-h-screen flex-col'>
          <Providers>
            <Header />
            <div className='relative mx-auto flex w-full max-w-7xl flex-1 flex-col p-6'>
              {children}
            </div>
          </Providers>
        </main>

        <Analytics />
      </body>
    </html>
  )
}

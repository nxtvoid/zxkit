import notiPkg from '../../../packages/noti/package.json'
import authzPkg from '../../../packages/authz/package.json'
import chronoPkg from '../../../packages/chrono/package.json'
import qrixPkg from '../../../packages/qrix/package.json'
import surfacePkg from '../../../packages/surface/package.json'

type ComponentOption = {
  title: string
  description: string
  version?: string
  image: {
    light: string
    dark: string
  }
  link: string
  command?: string
}

const COMPONENTS_OPTIONS: ComponentOption[] = [
  {
    title: notiPkg.name,
    description:
      'A notification system for React and Next.js applications. Easily display and manage notifications with customizable styles and behaviors.',
    version: notiPkg.version,
    image: {
      light: '/noti-light.webp',
      dark: '/noti-dark.webp',
    },
    link: '/noti',
    command: `bun i ${notiPkg.name}`,
  },
  {
    title: qrixPkg.name,
    description:
      'Generate QR codes with ease using qrix. A powerful component to generate and visualize QR codes seamlessly into your React interface.',
    version: qrixPkg.version,
    image: {
      light: '/qrix-light.webp',
      dark: '/qrix-dark.webp',
    },
    link: '/qrix',
    command: `bun i ${qrixPkg.name}`,
  },
  {
    title: surfacePkg.name,
    description:
      'Handle your dialog, sheet and drawer with ease. A unified and accessible overlay API designed for flexibility, built on top of modern React primitives.',
    version: surfacePkg.version,
    image: {
      light: '/surface-light.webp',
      dark: '/surface-dark.webp',
    },
    link: '/surface',
    command: `bun i ${surfacePkg.name}`,
  },
  {
    title: authzPkg.name,
    description:
      'Typed authorization helpers for roles, permissions, and guards. Easily manage and secure your React and Next.js applications with confidence.',
    version: authzPkg.version,
    image: {
      light: '/authz-light.webp',
      dark: '/authz-dark.webp',
    },
    link: '/authz',
    command: `bun i ${authzPkg.name}`,
  },
  {
    title: chronoPkg.name,
    description:
      'Zero-dependency calendar dates and timezone-aware instants. Branded PlainDate, DATE column semantics, and DST-safe zone helpers behind a total API that never throws.',
    version: chronoPkg.version,
    image: {
      light: '/chrono-light.webp',
      dark: '/chrono-dark.webp',
    },
    link: '/chrono',
    command: `bun i ${chronoPkg.name}`,
  },
]

export { COMPONENTS_OPTIONS, type ComponentOption }

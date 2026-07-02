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
    title: '@zxkit/qrix',
    description:
      'Generate QR codes with ease using qrix. A powerful component to generate and visualize QR codes seamlessly into your React interface.',
    version: '1.0.2',
    image: {
      light: '/qrix-light.webp',
      dark: '/qrix-dark.webp',
    },
    link: '/qrix',
    command: 'bun i @zxkit/qrix',
  },
  {
    title: '@zxkit/surface',
    description:
      'Handle your dialog, sheet and drawer with ease. A unified and accessible overlay API designed for flexibility, built on top of modern React primitives.',
    version: '1.1.1',
    image: {
      light: '/surface-light.webp',
      dark: '/surface-dark.webp',
    },
    link: '/surface',
    command: 'bun i @zxkit/surface',
  },
  {
    title: '@zxkit/authz',
    description:
      'Typed authorization helpers for roles, permissions, and guards. Easily manage and secure your React and Next.js applications with confidence.',
    version: '1.0.0',
    image: {
      light: '/authz-light.webp',
      dark: '/authz-dark.webp',
    },
    link: '/authz',
    command: 'bun i @zxkit/authz',
  },
  {
    title: '@zxkit/chrono',
    description:
      'Zero-dependency calendar dates and timezone-aware instants. Branded PlainDate, DATE column semantics, and DST-safe zone helpers behind a total API that never throws.',
    image: {
      light: '/chrono-light.webp',
      dark: '/chrono-dark.webp',
    },
    link: '/chrono',
    command: 'bun i @zxkit/chrono',
  },
]

export { COMPONENTS_OPTIONS, type ComponentOption }

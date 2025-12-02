type ComponentOption = {
  title: string
  description: string
  image: {
    light: string
    dark: string
  }
  link: string
}

const COMPONENTS_OPTIONS: ComponentOption[] = [
  {
    title: 'qrix',
    description: 'Generate QR codes with ease using qrix.',
    image: {
      light: '/qrix-light.png',
      dark: '/qrix-dark.png',
    },
    link: '/qrix',
  },
]

export { COMPONENTS_OPTIONS, type ComponentOption }

import path from 'node:path'
import fs from 'fs-extra'
import ora from 'ora'

export async function createUIPackage(monorepoRoot: string) {
  const spinner = ora('Creating packages/ui structure...').start()

  const uiPath = path.join(monorepoRoot, 'packages', 'ui')

  try {
    // Create directory structure
    await fs.ensureDir(path.join(uiPath, 'src', 'components'))
    await fs.ensureDir(path.join(uiPath, 'src', 'hooks'))
    await fs.ensureDir(path.join(uiPath, 'src', 'lib'))
    await fs.ensureDir(path.join(uiPath, 'src', 'styles'))

    // Create package.json
    const packageJson = {
      name: '@workspace/ui',
      version: '0.0.0',
      type: 'module',
      private: true,
      scripts: {
        lint: 'eslint . --max-warnings 0',
        'check-types': 'tsc --noEmit',
      },
      dependencies: {
        'class-variance-authority': '^0.7.1',
        clsx: '^2.1.1',
        'tailwind-merge': '^3.3.1',
      },
      devDependencies: {
        '@tailwindcss/postcss': '^4.1.11',
        '@types/node': '^20.19.9',
        '@types/react': '^19.1.9',
        '@types/react-dom': '^19.1.7',
        '@workspace/eslint-config': 'workspace:*',
        '@workspace/typescript-config': 'workspace:*',
        eslint: '^9.32.0',
        tailwindcss: '^4.1.11',
        typescript: '^5.9.2',
      },
      peerDependencies: {
        react: '^18 || ^19',
        'react-dom': '^18 || ^19',
      },
      exports: {
        './globals.css': './src/styles/globals.css',
        './postcss.config': './postcss.config.mjs',
        './lib/*': './src/lib/*.ts',
        './components/*': './src/components/*.tsx',
        './hooks/*': './src/hooks/*.ts',
      },
    }

    await fs.writeJson(path.join(uiPath, 'package.json'), packageJson, { spaces: 2 })

    // Create tsconfig.json
    const tsconfig = {
      extends: '@workspace/typescript-config/react-library.json',
      compilerOptions: {
        outDir: 'dist',
        rootDir: 'src',
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    }

    await fs.writeJson(path.join(uiPath, 'tsconfig.json'), tsconfig, { spaces: 2 })

    // Create components.json (shadcn config)
    const componentsJson = {
      $schema: 'https://ui.shadcn.com/schema.json',
      style: 'new-york',
      rsc: true,
      tsx: true,
      tailwind: {
        config: '',
        css: 'src/styles/globals.css',
        baseColor: 'neutral',
        cssVariables: true,
      },
      iconLibrary: 'lucide',
      aliases: {
        components: '@workspace/ui/components',
        utils: '@workspace/ui/lib/utils',
        hooks: '@workspace/ui/hooks',
        lib: '@workspace/ui/lib',
        ui: '@workspace/ui/components',
      },
    }

    await fs.writeJson(path.join(uiPath, 'components.json'), componentsJson, { spaces: 2 })

    // Create postcss.config.mjs
    const postcssConfig = `export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
`
    await fs.writeFile(path.join(uiPath, 'postcss.config.mjs'), postcssConfig)

    // Create globals.css with Tailwind v4
    const globalsCss = `@import 'tailwindcss';

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}

@layer base {
  :root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --destructive-foreground: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.708 0 0);
    --radius: 0.625rem;
  }

  .dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.145 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.145 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.985 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.396 0.141 25.723);
    --destructive-foreground: oklch(0.985 0 0);
    --border: oklch(0.269 0 0);
    --input: oklch(0.269 0 0);
    --ring: oklch(0.439 0 0);
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`
    await fs.writeFile(path.join(uiPath, 'src', 'styles', 'globals.css'), globalsCss)

    // Create utils.ts
    const utilsTs = `import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`
    await fs.writeFile(path.join(uiPath, 'src', 'lib', 'utils.ts'), utilsTs)

    // Create index.ts
    const indexTs = `// Utils
export * from './lib/utils'
`
    await fs.writeFile(path.join(uiPath, 'src', 'index.ts'), indexTs)

    spinner.succeed('Created packages/ui structure')
  } catch (error) {
    spinner.fail('Failed to create packages/ui')
    throw error
  }
}

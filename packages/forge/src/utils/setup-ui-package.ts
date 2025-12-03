import path from 'node:path'
import fs from 'fs-extra'
import ora from 'ora'

import { logger } from './logger'
import { updateExports } from './update-exports'
import { updateImportPaths, updateAppImports } from './update-import-paths'

interface SetupOptions {
  monorepoRoot: string
  uiPackagePath: string
  scopeName: string
  isExisting: boolean
}

export async function setupUIPackage(options: SetupOptions) {
  const { monorepoRoot, uiPackagePath, scopeName, isExisting } = options
  const uiPackageName = `@${scopeName}/ui`

  const spinner = ora(
    isExisting ? 'Configuring packages/ui...' : 'Creating packages/ui structure...'
  ).start()

  try {
    // Create directory structure (if not existing)
    await fs.ensureDir(path.join(uiPackagePath, 'src', 'components'))
    await fs.ensureDir(path.join(uiPackagePath, 'src', 'hooks'))
    await fs.ensureDir(path.join(uiPackagePath, 'src', 'lib'))
    await fs.ensureDir(path.join(uiPackagePath, 'src', 'styles'))

    // Update or create package.json
    await setupPackageJson(uiPackagePath, uiPackageName, isExisting)

    // Update or create tsconfig.json
    await setupTsConfig(uiPackagePath, isExisting)

    // Update or create components.json
    await setupComponentsJson(uiPackagePath, uiPackageName, isExisting)

    // Create postcss.config.mjs if not exists
    await setupPostcssConfig(uiPackagePath)

    // Create globals.css if not exists
    await setupGlobalsCss(uiPackagePath)

    // Create utils.ts if not exists
    await setupUtils(uiPackagePath)

    // Update import paths in existing UI package files
    if (isExisting) {
      spinner.text = 'Updating import paths in packages/ui...'
      await updateImportPaths(uiPackagePath, uiPackageName)
    }

    // Update index.ts with proper exports (always update to fix .js extensions)
    await updateExports(uiPackagePath)

    // Update apps to use the new package name with barrel imports
    spinner.text = 'Updating imports in apps...'
    await updateAppImports(monorepoRoot, uiPackageName)

    // Update apps/web package.json dependency
    await updateAppsWeb(monorepoRoot, uiPackageName)

    spinner.succeed(isExisting ? 'Configured packages/ui' : 'Created packages/ui structure')
  } catch (error) {
    spinner.fail('Failed to setup packages/ui')
    throw error
  }
}

async function setupPackageJson(uiPackagePath: string, uiPackageName: string, isExisting: boolean) {
  const packageJsonPath = path.join(uiPackagePath, 'package.json')

  let packageJson: Record<string, unknown> = {}

  if (isExisting && (await fs.pathExists(packageJsonPath))) {
    packageJson = await fs.readJson(packageJsonPath)
  }

  // Update with forge configuration
  packageJson = {
    ...packageJson,
    name: uiPackageName,
    version: packageJson.version || '0.0.0',
    type: 'module',
    private: true,
    main: './src/index.ts',
    types: './src/index.ts',
    scripts: {
      ...(packageJson.scripts as Record<string, string> | undefined),
      lint: 'eslint . --max-warnings 0',
      'check-types': 'tsc --noEmit',
    },
    dependencies: {
      ...(packageJson.dependencies as Record<string, string> | undefined),
      'class-variance-authority': '^0.7.1',
      clsx: '^2.1.1',
      'tailwind-merge': '^3.3.1',
    },
    devDependencies: {
      ...(packageJson.devDependencies as Record<string, string> | undefined),
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
      '.': {
        types: './src/index.ts',
        default: './src/index.ts',
      },
      './globals.css': './src/styles/globals.css',
      './postcss.config': './postcss.config.mjs',
      './lib/*': './src/lib/*.ts',
      './components/*': './src/components/*.tsx',
      './hooks/*': './src/hooks/*.ts',
    },
  }

  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
}

async function setupTsConfig(uiPackagePath: string, isExisting: boolean) {
  const tsconfigPath = path.join(uiPackagePath, 'tsconfig.json')

  if (isExisting && (await fs.pathExists(tsconfigPath))) {
    // Keep existing tsconfig, just make sure it has the right extends
    const tsconfig = await fs.readJson(tsconfigPath)
    if (!tsconfig.extends) {
      tsconfig.extends = '@workspace/typescript-config/react-library.json'
      await fs.writeJson(tsconfigPath, tsconfig, { spaces: 2 })
    }
    return
  }

  const tsconfig = {
    extends: '@workspace/typescript-config/react-library.json',
    compilerOptions: {
      outDir: 'dist',
      rootDir: 'src',
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  }

  await fs.writeJson(tsconfigPath, tsconfig, { spaces: 2 })
}

async function setupComponentsJson(
  uiPackagePath: string,
  uiPackageName: string,
  isExisting: boolean
) {
  const componentsJsonPath = path.join(uiPackagePath, 'components.json')

  let componentsJson: Record<string, unknown> = {}

  if (isExisting && (await fs.pathExists(componentsJsonPath))) {
    componentsJson = await fs.readJson(componentsJsonPath)
  }

  // Update aliases to use the correct package name
  componentsJson = {
    $schema: 'https://ui.shadcn.com/schema.json',
    style: componentsJson.style || 'new-york',
    rsc: componentsJson.rsc ?? true,
    tsx: componentsJson.tsx ?? true,
    tailwind: componentsJson.tailwind || {
      config: '',
      css: 'src/styles/globals.css',
      baseColor: 'neutral',
      cssVariables: true,
    },
    iconLibrary: componentsJson.iconLibrary || 'lucide',
    aliases: {
      components: `${uiPackageName}/components`,
      utils: `${uiPackageName}/lib/utils`,
      hooks: `${uiPackageName}/hooks`,
      lib: `${uiPackageName}/lib`,
      ui: `${uiPackageName}/components`,
    },
  }

  await fs.writeJson(componentsJsonPath, componentsJson, { spaces: 2 })
}

async function setupPostcssConfig(uiPackagePath: string) {
  const postcssPath = path.join(uiPackagePath, 'postcss.config.mjs')

  if (await fs.pathExists(postcssPath)) return

  const content = `export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
`
  await fs.writeFile(postcssPath, content)
}

async function setupGlobalsCss(uiPackagePath: string) {
  const cssPath = path.join(uiPackagePath, 'src', 'styles', 'globals.css')

  if (await fs.pathExists(cssPath)) return

  const content = `@import 'tailwindcss';

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
  await fs.writeFile(cssPath, content)
}

async function setupUtils(uiPackagePath: string) {
  const utilsPath = path.join(uiPackagePath, 'src', 'lib', 'utils.ts')

  if (await fs.pathExists(utilsPath)) return

  const content = `import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`
  await fs.writeFile(utilsPath, content)
}

async function updateAppsWeb(monorepoRoot: string, uiPackageName: string) {
  const webPackageJsonPath = path.join(monorepoRoot, 'apps', 'web', 'package.json')

  if (!(await fs.pathExists(webPackageJsonPath))) {
    logger.warn('apps/web not found, skipping dependency update')
    return
  }

  const webPackageJson = await fs.readJson(webPackageJsonPath)

  // Remove old @workspace/ui if exists, add new package name
  const deps = webPackageJson.dependencies as Record<string, string> | undefined
  if (deps) {
    // Remove any existing ui package reference
    delete deps['@workspace/ui']

    // Add the new package
    deps[uiPackageName] = 'workspace:*'
  } else {
    webPackageJson.dependencies = {
      [uiPackageName]: 'workspace:*',
    }
  }

  await fs.writeJson(webPackageJsonPath, webPackageJson, { spaces: 2 })
  logger.info(`Updated apps/web to use ${uiPackageName}`)
}

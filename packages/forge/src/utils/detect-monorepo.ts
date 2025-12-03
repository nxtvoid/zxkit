import path from 'node:path'
import fs from 'fs-extra'

export interface MonorepoInfo {
  root: string
  hasUIPackage: boolean
  uiPackagePath: string
  packageManager: 'bun' | 'pnpm' | 'npm' | 'yarn'
}

export async function detectMonorepo(): Promise<MonorepoInfo | null> {
  const cwd = process.cwd()

  // Walk up to find turbo.json
  let currentDir = cwd
  while (currentDir !== path.parse(currentDir).root) {
    const turboJsonPath = path.join(currentDir, 'turbo.json')

    if (await fs.pathExists(turboJsonPath)) {
      const uiPackagePath = path.join(currentDir, 'packages', 'ui')
      const hasUIPackage = await fs.pathExists(uiPackagePath)
      const packageManager = await detectPackageManager(currentDir)

      return {
        root: currentDir,
        hasUIPackage,
        uiPackagePath,
        packageManager,
      }
    }

    currentDir = path.dirname(currentDir)
  }

  return null
}

async function detectPackageManager(root: string): Promise<'bun' | 'pnpm' | 'npm' | 'yarn'> {
  // Check for lock files
  if (await fs.pathExists(path.join(root, 'bun.lockb'))) {
    return 'bun'
  }
  if (await fs.pathExists(path.join(root, 'bun.lock'))) {
    return 'bun'
  }
  if (await fs.pathExists(path.join(root, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  if (await fs.pathExists(path.join(root, 'yarn.lock'))) {
    return 'yarn'
  }
  if (await fs.pathExists(path.join(root, 'package-lock.json'))) {
    return 'npm'
  }

  // Check packageManager field in package.json
  const packageJsonPath = path.join(root, 'package.json')
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath)
    const pm = packageJson.packageManager as string | undefined

    if (pm?.startsWith('bun')) return 'bun'
    if (pm?.startsWith('pnpm')) return 'pnpm'
    if (pm?.startsWith('yarn')) return 'yarn'
  }

  return 'npm'
}

import path from 'node:path'
import fs from 'fs-extra'
import { fileURLToPath } from 'node:url'

export async function getPackageInfo() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const packageJsonPath = path.resolve(__dirname, '..', 'package.json')

  try {
    const packageJson = await fs.readJson(packageJsonPath)
    return packageJson as { version: string; name: string }
  } catch {
    // Fallback for development
    return { version: '0.0.1', name: '@zxkit/forge' }
  }
}

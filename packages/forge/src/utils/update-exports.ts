import path from 'node:path'
import fs from 'fs-extra'

import { logger } from './logger'

export async function updateExports(uiPackagePath: string) {
  const srcPath = path.join(uiPackagePath, 'src')
  const indexPath = path.join(srcPath, 'index.ts')

  const components = await getFilesInDir(path.join(srcPath, 'components'))
  const hooks = await getFilesInDir(path.join(srcPath, 'hooks'))
  const libs = await getFilesInDir(path.join(srcPath, 'lib'))

  const exports: string[] = []

  // Components
  if (components.length > 0) {
    exports.push('// Components')
    for (const file of components.sort()) {
      const name = path.basename(file, path.extname(file))
      exports.push(`export * from './components/${name}.js'`)
    }
    exports.push('')
  }

  // Hooks
  if (hooks.length > 0) {
    exports.push('// Hooks')
    for (const file of hooks.sort()) {
      const name = path.basename(file, path.extname(file))
      exports.push(`export * from './hooks/${name}.js'`)
    }
    exports.push('')
  }

  // Utils/Lib
  if (libs.length > 0) {
    exports.push('// Utils')
    for (const file of libs.sort()) {
      const name = path.basename(file, path.extname(file))
      exports.push(`export * from './lib/${name}.js'`)
    }
    exports.push('')
  }

  const content = exports.join('\n')
  await fs.writeFile(indexPath, content)

  logger.info('Updated src/index.ts exports')
}

async function getFilesInDir(dirPath: string): Promise<string[]> {
  try {
    const exists = await fs.pathExists(dirPath)
    if (!exists) return []

    const files = await fs.readdir(dirPath)
    return files.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
  } catch {
    return []
  }
}

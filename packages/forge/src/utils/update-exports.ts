import path from 'node:path'
import fs from 'fs-extra'

import { logger } from './logger'

export async function updateExports(uiPackagePath: string) {
  const srcPath = path.join(uiPackagePath, 'src')
  const indexPath = path.join(srcPath, 'index.ts')

  // Check moduleResolution in tsconfig.json
  const useJsExtension = await shouldUseJsExtension(uiPackagePath)
  const ext = useJsExtension ? '.js' : ''

  const components = await getFilesInDir(path.join(srcPath, 'components'))
  const hooks = await getFilesInDir(path.join(srcPath, 'hooks'))
  const libs = await getFilesInDir(path.join(srcPath, 'lib'))

  const exports: string[] = []

  // Components
  if (components.length > 0) {
    exports.push('// Components')
    for (const file of components.sort()) {
      const name = path.basename(file, path.extname(file))
      exports.push(`export * from './components/${name}${ext}'`)
    }
    exports.push('')
  }

  // Hooks
  if (hooks.length > 0) {
    exports.push('// Hooks')
    for (const file of hooks.sort()) {
      const name = path.basename(file, path.extname(file))
      exports.push(`export * from './hooks/${name}${ext}'`)
    }
    exports.push('')
  }

  // Utils/Lib
  if (libs.length > 0) {
    exports.push('// Utils')
    for (const file of libs.sort()) {
      const name = path.basename(file, path.extname(file))
      exports.push(`export * from './lib/${name}${ext}'`)
    }
    exports.push('')
  }

  const content = exports.join('\n')
  await fs.writeFile(indexPath, content)

  logger.info('Updated src/index.ts exports')
}

/**
 * Check if .js extension should be used in imports
 * Returns true if moduleResolution is NOT "Bundler" (case-insensitive)
 */
async function shouldUseJsExtension(uiPackagePath: string): Promise<boolean> {
  const tsconfigPath = path.join(uiPackagePath, 'tsconfig.json')

  try {
    if (!(await fs.pathExists(tsconfigPath))) {
      // Default to using .js if no tsconfig found
      return true
    }

    // Resolve tsconfig with extends
    const resolvedConfig = await resolveTsConfig(tsconfigPath, uiPackagePath)
    const moduleResolution = resolvedConfig.compilerOptions?.moduleResolution

    if (!moduleResolution) {
      // Default to using .js if moduleResolution not specified
      return true
    }

    // If moduleResolution is "Bundler" (case-insensitive), don't use .js
    return moduleResolution.toLowerCase() !== 'bundler'
  } catch (error) {
    // On error, default to using .js
    if (error instanceof Error) {
      logger.warn(`Error resolving tsconfig: ${error.message}, defaulting to .js extensions`)
    } else {
      logger.warn(`Could not read tsconfig.json, defaulting to .js extensions`)
    }
    return true
  }
}

/**
 * Resolve tsconfig.json with extends support
 */
async function resolveTsConfig(
  tsconfigPath: string,
  basePath: string,
  visited = new Set<string>()
): Promise<{ compilerOptions?: { moduleResolution?: string } }> {
  // Prevent circular references
  if (visited.has(tsconfigPath)) {
    return {}
  }
  visited.add(tsconfigPath)

  if (!(await fs.pathExists(tsconfigPath))) {
    return {}
  }

  try {
    const content = await fs.readFile(tsconfigPath, 'utf-8')

    // Remove comments more carefully (JSONC format)
    const jsonContent = content
      // Remove single-line comments
      .split('\n')
      .map((line) => {
        const commentIndex = line.indexOf('//')
        if (commentIndex !== -1) {
          // Check if // is inside a string
          const beforeComment = line.substring(0, commentIndex)
          const quoteCount = (beforeComment.match(/"/g) || []).length
          if (quoteCount % 2 === 0) {
            // Even quotes = not in string, safe to remove
            return line.substring(0, commentIndex)
          }
        }
        return line
      })
      .join('\n')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove trailing commas
      .replace(/,(\s*[}\]])/g, '$1')

    const tsconfig = JSON.parse(jsonContent)

    // If no extends, return as is
    if (!tsconfig.extends) {
      return tsconfig
    }

    // Resolve extends path
    let extendsPath = tsconfig.extends

    // Handle @workspace/* or scoped package references
    if (extendsPath.startsWith('@')) {
      // Try to resolve from node_modules
      const nodeModulesPath = path.join(basePath, 'node_modules', extendsPath)
      if (await fs.pathExists(nodeModulesPath)) {
        extendsPath = nodeModulesPath
      } else {
        // Try workspace resolution (look in parent directories)
        const workspaceRoot = await findWorkspaceRoot(basePath)
        if (workspaceRoot) {
          const packageName = extendsPath.split('/')[0]
          const subPath = extendsPath.substring(packageName.length + 1)
          const workspacePath = path.join(
            workspaceRoot,
            'packages',
            packageName.replace('@workspace/', ''),
            subPath
          )
          if (await fs.pathExists(workspacePath)) {
            extendsPath = workspacePath
          }
        }
      }
    } else {
      // Relative path
      extendsPath = path.resolve(path.dirname(tsconfigPath), extendsPath)
    }

    // Add .json if not present
    if (!extendsPath.endsWith('.json')) {
      extendsPath += '.json'
    }

    // Recursively resolve the extended config
    const baseConfig = await resolveTsConfig(extendsPath, basePath, visited)

    // Merge configs (child overrides parent)
    return {
      ...baseConfig,
      compilerOptions: {
        ...baseConfig.compilerOptions,
        ...tsconfig.compilerOptions,
      },
    }
  } catch (err) {
    // Return empty config on parse error
    if (err instanceof Error) {
      logger.warn(`Error parsing tsconfig.json: ${err.message}, defaulting to empty config`)
    } else {
      logger.warn(`Could not parse tsconfig.json, defaulting to empty config`)
    }
    return {}
  }
}

/**
 * Find workspace root by looking for turbo.json
 */
async function findWorkspaceRoot(startPath: string): Promise<string | null> {
  let currentDir = startPath
  while (currentDir !== path.parse(currentDir).root) {
    const turboJsonPath = path.join(currentDir, 'turbo.json')
    if (await fs.pathExists(turboJsonPath)) {
      return currentDir
    }
    currentDir = path.dirname(currentDir)
  }
  return null
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

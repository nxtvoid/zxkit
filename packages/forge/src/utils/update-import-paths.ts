import path from 'node:path'
import fs from 'fs-extra'

import { logger } from './logger'

/**
 * Updates import paths in existing component files to use the new package name
 */
export async function updateImportPaths(
  uiPackagePath: string,
  newPackageName: string,
  oldPatterns: string[] = ['@workspace/ui', '@/']
) {
  const srcPath = path.join(uiPackagePath, 'src')

  const directories = ['components', 'hooks', 'lib']
  let updatedFiles = 0

  for (const dir of directories) {
    const dirPath = path.join(srcPath, dir)

    if (!(await fs.pathExists(dirPath))) continue

    const files = await fs.readdir(dirPath)

    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue

      const filePath = path.join(dirPath, file)
      let content = await fs.readFile(filePath, 'utf-8')
      let modified = false

      for (const oldPattern of oldPatterns) {
        if (content.includes(oldPattern)) {
          // Replace the old pattern with the new package name
          // @workspace/ui/components -> @zxkit/ui/components
          // @workspace/ui/lib -> @zxkit/ui/lib
          // @/lib -> @zxkit/ui/lib
          // @/components -> @zxkit/ui/components

          if (oldPattern === '@/') {
            // Handle @/ alias - convert to full package path
            content = content.replace(
              /from ['"]@\/components\//g,
              `from '${newPackageName}/components/`
            )
            content = content.replace(/from ['"]@\/lib\//g, `from '${newPackageName}/lib/`)
            content = content.replace(/from ['"]@\/hooks\//g, `from '${newPackageName}/hooks/`)
            content = content.replace(/from ['"]@\/ui\//g, `from '${newPackageName}/components/`)
          } else {
            // Handle full package names like @workspace/ui
            const escapedPattern = oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const regex = new RegExp(`from ['"]${escapedPattern}`, 'g')
            content = content.replace(regex, `from '${newPackageName}`)
          }

          modified = true
        }
      }

      if (modified) {
        await fs.writeFile(filePath, content)
        updatedFiles++
      }
    }
  }

  if (updatedFiles > 0) {
    logger.info(`Updated import paths in ${updatedFiles} file(s)`)
  }
}

/**
 * Updates import paths in apps to use the barrel export from @scope/ui
 * Converts: import { Button } from '@workspace/ui/components/button'
 * To:       import { Button } from '@zxkit/ui'
 */
export async function updateAppImports(
  monorepoRoot: string,
  newPackageName: string,
  oldPatterns: string[] = ['@workspace/ui']
) {
  const appsPath = path.join(monorepoRoot, 'apps')

  if (!(await fs.pathExists(appsPath))) {
    return
  }

  const apps = await fs.readdir(appsPath)
  let totalUpdatedFiles = 0

  for (const app of apps) {
    const appPath = path.join(appsPath, app)
    const stat = await fs.stat(appPath)

    if (!stat.isDirectory()) continue

    const updatedFiles = await updateImportsInDirectory(appPath, newPackageName, oldPatterns)
    totalUpdatedFiles += updatedFiles
  }

  if (totalUpdatedFiles > 0) {
    logger.info(`Updated imports in ${totalUpdatedFiles} app file(s) to use '${newPackageName}'`)
  }
}

async function updateImportsInDirectory(
  dirPath: string,
  newPackageName: string,
  oldPatterns: string[]
): Promise<number> {
  let updatedFiles = 0

  const entries = await fs.readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)

    // Skip node_modules and .next
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') {
      continue
    }

    if (entry.isDirectory()) {
      updatedFiles += await updateImportsInDirectory(fullPath, newPackageName, oldPatterns)
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      const wasUpdated = await updateFileImports(fullPath, newPackageName, oldPatterns)
      if (wasUpdated) updatedFiles++
    }
  }

  return updatedFiles
}

async function updateFileImports(
  filePath: string,
  newPackageName: string,
  oldPatterns: string[]
): Promise<boolean> {
  let content = await fs.readFile(filePath, 'utf-8')
  let modified = false

  for (const oldPattern of oldPatterns) {
    // Match imports like: import { X } from '@workspace/ui/components/x'
    // And convert to:     import { X } from '@zxkit/ui'
    const escapedPattern = oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Pattern to match @workspace/ui/components/*, @workspace/ui/lib/*, @workspace/ui/hooks/*
    const importRegex = new RegExp(
      `from\\s*['"]${escapedPattern}/(components|lib|hooks)/[^'"]+['"]`,
      'g'
    )

    if (importRegex.test(content)) {
      content = content.replace(importRegex, `from '${newPackageName}'`)
      modified = true
    }

    // Also handle direct @workspace/ui imports (already correct format)
    const directImportRegex = new RegExp(`from\\s*['"]${escapedPattern}['"]`, 'g')
    if (directImportRegex.test(content)) {
      content = content.replace(directImportRegex, `from '${newPackageName}'`)
      modified = true
    }
  }

  if (modified) {
    await fs.writeFile(filePath, content)
  }

  return modified
}

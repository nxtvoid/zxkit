import path from 'node:path'
import fs from 'fs-extra'
import pc from 'picocolors'

import type { RegistryItem, RegistryItemFile } from './registry'
import type { Config } from './get-config'
import { logger } from './logger'

export async function writeComponent(
  uiPackagePath: string,
  item: RegistryItem,
  config: Config,
  overwrite: boolean = false
) {
  if (!item.files?.length) {
    logger.warn(`No files found for ${item.name}`)
    return
  }

  for (const file of item.files) {
    const targetPath = resolveFilePath(uiPackagePath, file)

    // Check if file exists
    if (!overwrite && (await fs.pathExists(targetPath))) {
      logger.warn(`Skipping ${pc.cyan(path.basename(targetPath))} (already exists)`)
      continue
    }

    // Transform content
    const content = transformContent(file.content || '', config)

    // Ensure directory exists
    await fs.ensureDir(path.dirname(targetPath))

    // Write file
    await fs.writeFile(targetPath, content)
    logger.info(`Created ${pc.cyan(path.relative(uiPackagePath, targetPath))}`)
  }
}

function resolveFilePath(uiPackagePath: string, file: RegistryItemFile): string {
  const { type, path: filePath, target } = file

  // Use target if specified
  if (target) {
    return path.join(uiPackagePath, 'src', target)
  }

  // Resolve based on type
  switch (type) {
    case 'registry:ui':
    case 'registry:component':
      return path.join(uiPackagePath, 'src', 'components', path.basename(filePath))

    case 'registry:hook':
      return path.join(uiPackagePath, 'src', 'hooks', path.basename(filePath))

    case 'registry:lib':
      return path.join(uiPackagePath, 'src', 'lib', path.basename(filePath))

    default:
      // Default to components
      return path.join(uiPackagePath, 'src', 'components', path.basename(filePath))
  }
}

function transformContent(content: string, config: Config): string {
  let transformed = content

  // Transform import paths based on aliases
  // Shadcn registry uses various path patterns that need to be transformed

  const componentsAlias = config.aliases.components
  const libAlias = config.aliases.lib || config.aliases.utils.replace('/utils', '')
  const hooksAlias = config.aliases.hooks || componentsAlias.replace('/components', '/hooks')
  const uiAlias = config.aliases.ui || componentsAlias

  // Replace @/registry/*/ui/* patterns (new shadcn format)
  transformed = transformed.replace(
    /from ["']@\/registry\/[^/]+\/ui\/([^"']+)["']/g,
    `from "${componentsAlias}/$1"`
  )

  // Replace @/registry/*/hooks/* patterns
  transformed = transformed.replace(
    /from ["']@\/registry\/[^/]+\/hooks\/([^"']+)["']/g,
    `from "${hooksAlias}/$1"`
  )

  // Replace @/registry/*/lib/* patterns
  transformed = transformed.replace(
    /from ["']@\/registry\/[^/]+\/lib\/([^"']+)["']/g,
    `from "${libAlias}/$1"`
  )

  // Standard alias replacements
  const aliasMap: Record<string, string> = {
    '@/components': componentsAlias,
    '@/lib': libAlias,
    '@/hooks': hooksAlias,
    '@/ui': uiAlias,
  }

  for (const [from, to] of Object.entries(aliasMap)) {
    // Handle both exact matches and path matches
    transformed = transformed.replace(new RegExp(`from ["']${from}["']`, 'g'), `from "${to}"`)
    transformed = transformed.replace(new RegExp(`from ["']${from}/`, 'g'), `from "${to}/`)
  }

  return transformed
}

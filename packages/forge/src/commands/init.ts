import path from 'node:path'
import fs from 'fs-extra'
import pc from 'picocolors'
import prompts from 'prompts'

import { logger } from '../utils/logger'
import { Command } from 'commander'
import { detectMonorepo } from '../utils/detect-monorepo'
import { setupUIPackage } from '../utils/setup-ui-package'

function isValidScopeName(name: string): boolean {
  // Scope name: only lowercase letters, numbers, and single hyphens (not at start/end)
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)
}

export const init = new Command()
  .name('init')
  .description('Initialize/configure the UI package structure in your monorepo')
  .action(async () => {
    logger.info('Initializing forge...\n')

    // 1. Detect monorepo (must have turbo.json)
    const monorepo = await detectMonorepo()
    if (!monorepo) {
      logger.error('No Turborepo monorepo detected.')
      logger.info(`Make sure you have a ${pc.cyan('turbo.json')} file in your project root.`)
      process.exit(1)
    }

    logger.success(`Detected Turborepo at ${pc.cyan(monorepo.root)}`)

    // 2. Check if shadcn was initialized (components.json should exist somewhere)
    const rootComponentsJson = path.join(monorepo.root, 'components.json')
    const uiComponentsJson = path.join(monorepo.uiPackagePath, 'components.json')

    const hasRootConfig = await fs.pathExists(rootComponentsJson)
    const hasUIConfig = await fs.pathExists(uiComponentsJson)

    if (!hasRootConfig && !hasUIConfig) {
      logger.error('No components.json found.')
      logger.info(
        `Please run ${pc.cyan('bunx --bun shadcn@latest init')} first to initialize shadcn.`
      )
      process.exit(1)
    }

    // 3. Detect project name from root package.json
    const rootPackageJsonPath = path.join(monorepo.root, 'package.json')
    let scopeName: string | null = null

    if (await fs.pathExists(rootPackageJsonPath)) {
      const rootPackageJson = await fs.readJson(rootPackageJsonPath)
      const projectName = rootPackageJson.name as string | undefined

      if (projectName && isValidScopeName(projectName)) {
        scopeName = projectName
      }
    }

    // 4. If no valid scope name, ask user
    if (!scopeName) {
      const response = await prompts({
        type: 'text',
        name: 'scopeName',
        message: 'Enter the scope name for your UI package (e.g., "my-app" for @my-app/ui):',
        validate: (value) => {
          if (!value) return 'Scope name is required'
          if (!isValidScopeName(value)) {
            return 'Invalid name. Use lowercase letters, numbers, and hyphens only (e.g., "my-app")'
          }
          return true
        },
      })

      if (!response.scopeName) {
        logger.error('Initialization cancelled.')
        process.exit(1)
      }

      scopeName = response.scopeName
    }

    const uiPackageName = `@${scopeName}/ui`
    logger.info(`\nUI package will be named: ${pc.cyan(uiPackageName)}`)

    // 5. Check if packages/ui exists
    if (monorepo.hasUIPackage) {
      logger.warn(`\n${pc.yellow('packages/ui')} already exists.`)

      const response = await prompts({
        type: 'confirm',
        name: 'modify',
        message: 'Do you want to modify it to work with forge?',
        initial: false,
      })

      if (!response.modify) {
        logger.info('Initialization cancelled. No changes were made.')
        process.exit(0)
      }
    }

    if (!scopeName) {
      logger.error('Scope name is required.')
      process.exit(1)
    }

    // 6. Setup/modify the UI package
    await setupUIPackage({
      monorepoRoot: monorepo.root,
      uiPackagePath: monorepo.uiPackagePath,
      scopeName,
      isExisting: monorepo.hasUIPackage,
    })

    logger.success(`\n✓ Successfully configured ${pc.cyan(uiPackageName)}!`)
    logger.info(`\nNext steps:
  1. Run ${pc.cyan('bun install')} to install dependencies
  2. Use ${pc.cyan('forge add <component>')} to add components
  3. Import in your app: ${pc.cyan(`import { Button } from '${uiPackageName}'`)}
`)
  })

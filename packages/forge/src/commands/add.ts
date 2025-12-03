import { Command } from 'commander'
import pc from 'picocolors'
import ora from 'ora'

import { detectMonorepo } from '../utils/detect-monorepo'
import { getConfig } from '../utils/get-config'
import { fetchRegistry, resolveRegistryDependencies, type Style } from '../utils/registry'
import { installDependencies } from '../utils/install-dependencies'
import { writeComponent } from '../utils/write-component'
import { updateExports } from '../utils/update-exports'
import { logger } from '../utils/logger'

export const add = new Command()
  .name('add')
  .description('Add components from the shadcn registry')
  .argument('[components...]', 'components to add')
  .option('-y, --yes', 'skip confirmation prompt', false)
  .option('-o, --overwrite', 'overwrite existing files', false)
  .action(async (components: string[], opts) => {
    if (!components.length) {
      logger.error('Please provide at least one component to add.')
      logger.info(`Example: ${pc.cyan('forge add button avatar')}`)
      process.exit(1)
    }

    // 1. Detect monorepo
    const monorepo = await detectMonorepo()
    if (!monorepo) {
      logger.error('No Turborepo monorepo detected. Run `forge init` first.')
      process.exit(1)
    }

    if (!monorepo.hasUIPackage) {
      logger.error('packages/ui not found. Run `forge init` first.')
      process.exit(1)
    }

    // 2. Load config
    const config = await getConfig(monorepo.uiPackagePath)
    if (!config) {
      logger.error('No components.json found in packages/ui.')
      process.exit(1)
    }

    // 3. Fetch components from registry
    const spinner = ora(`Fetching ${components.join(', ')}...`).start()
    const style = (config.style || 'new-york') as Style

    try {
      const registryItems = await fetchRegistry(components, style)
      const allItems = await resolveRegistryDependencies(registryItems, style)

      spinner.succeed(`Found ${allItems.length} item(s) to install`)

      // 4. Collect all dependencies
      const dependencies = new Set<string>()
      for (const item of allItems) {
        item.dependencies?.forEach((dep) => dependencies.add(dep))
      }

      // 5. Install npm dependencies
      if (dependencies.size > 0) {
        await installDependencies(monorepo.uiPackagePath, Array.from(dependencies))
      }

      // 6. Write component files
      for (const item of allItems) {
        await writeComponent(monorepo.uiPackagePath, item, config, opts.overwrite)
      }

      // 7. Update exports
      await updateExports(monorepo.uiPackagePath)

      logger.success(`\nSuccessfully added: ${pc.cyan(components.join(', '))}`)
    } catch (error) {
      spinner.fail('Failed to fetch components')
      logger.error(error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

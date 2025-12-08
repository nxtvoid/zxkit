import { Command } from 'commander'
import pc from 'picocolors'
import ora from 'ora'
import prompts from 'prompts'
import path from 'node:path'
import fs from 'fs-extra'

import { detectMonorepo } from '../utils/detect-monorepo'
import { getConfig } from '../utils/get-config'
import { runShadcnView, writeComponentFiles } from '../utils/run-shadcn'
import { updateExports } from '../utils/update-exports'
import { installDependencies } from '../utils/install-dependencies'
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

    const spinner = ora('Processing components...').start()
    logger.info(`Adding components: ${pc.cyan(components.join(', '))}`)

    try {
      const allDependencies = new Set<string>()
      const allCssVars: Record<string, Record<string, string>> = {}
      const processedComponents = new Set<string>()
      const componentsToProcess: string[] = [...components]

      // 3. Process components with registryDependencies resolution
      while (componentsToProcess.length > 0) {
        const componentName = componentsToProcess.shift()!

        // Skip if already processed
        if (processedComponents.has(componentName)) {
          continue
        }

        // Check if component already exists BEFORE fetching
        const componentPath = path.join(
          monorepo.uiPackagePath,
          'src',
          'components',
          `${componentName}.tsx`
        )
        const exists = await fs.pathExists(componentPath)

        if (exists && !opts.overwrite && !components.includes(componentName)) {
          // Component exists and is a dependency, skip without fetching
          logger.info(`Component ${pc.cyan(componentName)} already exists, skipping`)
          processedComponents.add(componentName)
          continue
        }

        if (exists && !opts.overwrite && components.includes(componentName)) {
          // Component exists and user requested it, ask for overwrite
          const response = await prompts({
            type: 'confirm',
            name: 'overwrite',
            message: `Component ${pc.cyan(componentName)} already exists. Overwrite?`,
            initial: false,
          })

          if (!response.overwrite) {
            logger.info(`Skipping ${pc.cyan(componentName)}`)
            processedComponents.add(componentName)
            continue
          }
        }

        // Only fetch if we're going to install it
        spinner.text = `Fetching ${componentName}...`

        // Use shadcn view to get the latest component data
        const component = await runShadcnView(monorepo.root, componentName)

        // Collect npm dependencies
        component.dependencies?.forEach((dep) => allDependencies.add(dep))

        // Collect CSS variables
        if (component.cssVars) {
          Object.entries(component.cssVars).forEach(([theme, vars]) => {
            if (!allCssVars[theme]) {
              allCssVars[theme] = {}
            }
            Object.assign(allCssVars[theme], vars)
          })
        }

        // Write component files
        spinner.text = `Writing ${componentName} to packages/ui...`
        await writeComponentFiles(monorepo.uiPackagePath, component, config, opts.overwrite)

        processedComponents.add(componentName)

        // Add registry dependencies to the queue
        if (component.registryDependencies?.length) {
          for (const dep of component.registryDependencies) {
            if (!processedComponents.has(dep)) {
              componentsToProcess.push(dep)
            }
          }
        }
      }

      // 4. Install npm dependencies in packages/ui
      if (allDependencies.size > 0) {
        spinner.text = 'Installing dependencies...'
        await installDependencies(monorepo.uiPackagePath, Array.from(allDependencies))
      }

      // 5. Update CSS variables if present
      if (Object.keys(allCssVars).length > 0) {
        spinner.text = 'Updating CSS variables...'
        await updateCssVars(monorepo.uiPackagePath, allCssVars)
      }

      // 6. Update exports
      spinner.text = 'Updating exports...'
      await updateExports(monorepo.uiPackagePath)

      spinner.succeed(`Successfully added: ${pc.cyan(components.join(', '))}`)

      if (processedComponents.size > components.length) {
        const deps = Array.from(processedComponents).filter((c) => !components.includes(c))
        logger.info(`Also installed dependencies: ${pc.cyan(deps.join(', '))}`)
      }
    } catch (error) {
      spinner.fail('Failed to add components')
      logger.error(error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

/**
 * Update CSS variables in globals.css
 */
async function updateCssVars(
  uiPackagePath: string,
  cssVars: Record<string, Record<string, string>>
): Promise<void> {
  const globalsPath = path.join(uiPackagePath, 'src', 'styles', 'globals.css')

  if (!(await fs.pathExists(globalsPath))) {
    logger.warn('globals.css not found, skipping CSS variables update')
    return
  }

  let content = await fs.readFile(globalsPath, 'utf-8')

  // Update or add CSS variables for each theme
  for (const [theme, vars] of Object.entries(cssVars)) {
    const selector = theme === 'light' ? ':root' : `.${theme}`

    // Find existing theme block
    const themeRegex = new RegExp(
      `(${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*{[^}]*})`,
      's'
    )

    const existingVars = new Map<string, string>()
    const match = content.match(themeRegex)

    if (match) {
      // Extract existing variables
      const block = match?.[1] || ''
      const varRegex = /--([\w-]+):\s*([^;]+);/g
      let varMatch
      while ((varMatch = varRegex.exec(block)) !== null) {
        if (varMatch[1] && varMatch[2]) {
          existingVars.set(varMatch[1], varMatch[2].trim())
        }
      }

      // Merge new variables
      Object.entries(vars).forEach(([key, value]) => {
        existingVars.set(key, value)
      })

      // Rebuild theme block
      const newBlock = `${selector} {\n${Array.from(existingVars.entries())
        .map(([k, v]) => `    --${k}: ${v};`)
        .join('\n')}\n  }`

      content = content.replace(themeRegex, newBlock)
    } else {
      // Add new theme block
      const newBlock = `\n  ${selector} {\n${Object.entries(vars)
        .map(([k, v]) => `    --${k}: ${v};`)
        .join('\n')}\n  }`

      // Find @layer base and add inside it
      const layerBaseRegex = /@layer\s+base\s*{/
      if (layerBaseRegex.test(content)) {
        content = content.replace(layerBaseRegex, (match) => match + newBlock)
      } else {
        // Add at the end
        content += `\n@layer base {${newBlock}\n}\n`
      }
    }
  }

  await fs.writeFile(globalsPath, content)
  logger.info('Updated CSS variables in globals.css')
}

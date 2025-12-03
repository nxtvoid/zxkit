import { execa } from 'execa'
import ora from 'ora'
import pc from 'picocolors'

import { detectMonorepo } from './detect-monorepo'
import { logger } from './logger'

export async function installDependencies(uiPackagePath: string, dependencies: string[]) {
  if (dependencies.length === 0) return

  const monorepo = await detectMonorepo()
  if (!monorepo) return

  const spinner = ora(`Installing dependencies: ${dependencies.join(', ')}`).start()

  try {
    const { packageManager } = monorepo

    let command: string
    let args: string[]

    switch (packageManager) {
      case 'bun':
        command = 'bun'
        args = ['add', ...dependencies]
        break
      case 'pnpm':
        command = 'pnpm'
        args = ['add', ...dependencies]
        break
      case 'yarn':
        command = 'yarn'
        args = ['add', ...dependencies]
        break
      default:
        command = 'npm'
        args = ['install', ...dependencies]
    }

    await execa(command, args, {
      cwd: uiPackagePath,
      stdio: 'pipe',
    })

    spinner.succeed(`Installed ${pc.cyan(dependencies.length.toString())} dependencies`)
  } catch (error) {
    spinner.fail('Failed to install dependencies')
    logger.error(error instanceof Error ? error.message : 'Unknown error')
    throw error
  }
}

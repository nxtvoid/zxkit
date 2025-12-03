import { Command } from 'commander'

import { add } from './commands/add'
import { init } from './commands/init'
import { getPackageInfo } from './utils/get-package-info'

async function main() {
  const packageInfo = await getPackageInfo()

  const program = new Command()
    .name('forge')
    .description('CLI for adding shadcn components to Turborepo monorepos')
    .version(packageInfo.version || '0.0.1', '-v, --version', 'display the version number')

  program.addCommand(init)
  program.addCommand(add)

  program.parse()
}

main()

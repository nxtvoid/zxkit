import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

const baseRef = process.env.BASE_REF

if (!baseRef) {
  throw new Error('BASE_REF is required')
}

const changedFiles = execFileSync('git', ['diff', '--name-only', `origin/${baseRef}...HEAD`], {
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .filter(Boolean)

const publishablePackageDirs = readdirSync('packages', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join('packages', entry.name))
  .filter((packageDir) => {
    const manifestPath = join(packageDir, 'package.json')

    if (!existsSync(manifestPath)) {
      return false
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

    return manifest.private !== true
  })
  .map((packageDir) => packageDir.replaceAll('\\', '/'))

const changedPublishablePackages = new Set(
  changedFiles
    .map((file) => file.replaceAll('\\', '/'))
    .flatMap((file) =>
      publishablePackageDirs.filter(
        (packageDir) => file === packageDir || file.startsWith(`${packageDir}/`)
      )
    )
)

const needsChangeset = changedPublishablePackages.size > 0
const output = process.env.GITHUB_OUTPUT

if (output) {
  appendFileSync(output, `needs_changeset=${needsChangeset}\n`)
}

if (needsChangeset) {
  console.log(`Publishable package changes detected: ${[...changedPublishablePackages].join(', ')}`)
} else {
  console.log('No publishable package changes detected. Skipping changeset check.')
}

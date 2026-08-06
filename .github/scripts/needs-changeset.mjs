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

/**
 * Files that live inside a package but never reach the published tarball, and
 * that no build reads on the way there.
 *
 * Deliberately short. Asking for a changeset that was not needed costs a
 * comment on a pull request; skipping one that was needed publishes a change
 * nobody versioned, so anything uncertain stays out of this list. `src/**` is
 * absent on purpose: it feeds `dist`. So are `README.md` and `package.json`,
 * which ship inside the tarball itself.
 */
const RELEASE_IRRELEVANT = [
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /(^|\/)__tests__\//,
  /(^|\/)__mocks__\//,
  /(^|\/)eslint\.config\.[cm]?js$/,
  /(^|\/)vitest\.config\.[cm]?[jt]s$/,
  /(^|\/)\.prettierignore$/,
]

const isReleaseRelevant = (file) => !RELEASE_IRRELEVANT.some((pattern) => pattern.test(file))

const normalizedFiles = changedFiles.map((file) => file.replaceAll('\\', '/'))
const relevantFiles = normalizedFiles.filter(isReleaseRelevant)

const changedPublishablePackages = new Set(
  relevantFiles.flatMap((file) =>
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

const skipped = normalizedFiles.filter((file) => !isReleaseRelevant(file))

if (skipped.length > 0) {
  console.log(`Ignored as release-irrelevant:\n  ${skipped.join('\n  ')}`)
}

if (needsChangeset) {
  console.log(`Publishable package changes detected: ${[...changedPublishablePackages].join(', ')}`)
} else {
  console.log('No publishable package changes detected. Skipping changeset check.')
}

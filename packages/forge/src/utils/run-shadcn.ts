import path from 'node:path'
import fs from 'fs-extra'
import { execa } from 'execa'
import pc from 'picocolors'
import { z } from 'zod'

import { logger } from './logger'
import type { Config } from './get-config'

// Schema para shadcn view output
const shadcnFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  type: z.string(),
})

const shadcnViewItemSchema = z.object({
  name: z.string(),
  type: z.string(),
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
  registryDependencies: z.array(z.string()).optional(),
  files: z.array(shadcnFileSchema),
  tailwind: z
    .object({
      config: z.record(z.any()).optional(),
    })
    .optional(),
  cssVars: z
    .record(
      z.record(z.string()) // { light: { key: value }, dark: { key: value } }
    )
    .optional(),
})

export type ShadcnComponent = z.infer<typeof shadcnViewItemSchema>

/**
 * Ejecuta shadcn view para obtener el JSON con el contenido del componente
 */
export async function runShadcnView(
  monorepoRoot: string,
  component: string
): Promise<ShadcnComponent> {
  logger.info(`Fetching ${pc.cyan(component)} from shadcn...`)

  try {
    // Ejecutar: bunx --bun shadcn@latest view <component>
    const { stdout } = await execa('bunx', ['--bun', 'shadcn@latest', 'view', component], {
      cwd: monorepoRoot,
      stdio: 'pipe',
    })

    // Parsear JSON - shadcn view retorna un array con un objeto
    const data = JSON.parse(stdout)

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No data returned for component: ${component}`)
    }

    // Validar y retornar el primer item
    const validated = shadcnViewItemSchema.parse(data[0])

    logger.success(`Fetched ${pc.cyan(component)} (${validated.files.length} file(s))`)

    return validated
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('ENOENT')) {
        throw new Error(`Component "${component}" not found in shadcn registry`)
      }
      throw new Error(`Failed to fetch component: ${error.message}`)
    }
    throw error
  }
}

/**
 * Escribe el componente en packages/ui procesando los imports
 */
export async function writeComponentFiles(
  uiPackagePath: string,
  component: ShadcnComponent,
  config: Config,
  overwrite: boolean = false
): Promise<void> {
  for (const file of component.files) {
    const targetPath = resolveFilePath(uiPackagePath, file)

    // Verificar si existe
    if (!overwrite && (await fs.pathExists(targetPath))) {
      logger.warn(`Skipping ${pc.cyan(path.basename(targetPath))} (already exists)`)
      continue
    }

    // Transformar contenido
    const content = transformImports(file.content, config)

    // Asegurar directorio
    await fs.ensureDir(path.dirname(targetPath))

    // Escribir archivo
    await fs.writeFile(targetPath, content)
    logger.info(`Created ${pc.cyan(path.relative(uiPackagePath, targetPath))}`)
  }
}

/**
 * Resuelve la ruta del archivo basado en su tipo
 */
function resolveFilePath(uiPackagePath: string, file: { path: string; type: string }): string {
  const basename = path.basename(file.path)

  // Mapear tipos a directorios
  if (file.type.includes('ui') || file.type.includes('component')) {
    return path.join(uiPackagePath, 'src', 'components', basename)
  }
  if (file.type.includes('hook')) {
    return path.join(uiPackagePath, 'src', 'hooks', basename)
  }
  if (file.type.includes('lib')) {
    return path.join(uiPackagePath, 'src', 'lib', basename)
  }

  // Default: components
  return path.join(uiPackagePath, 'src', 'components', basename)
}

/**
 * Transforma imports de @/ a los aliases configurados
 */
function transformImports(content: string, config: Config): string {
  let transformed = content

  const componentsAlias = config.aliases.components
  const libAlias = config.aliases.lib || config.aliases.utils.replace('/utils', '')
  const hooksAlias = config.aliases.hooks || componentsAlias.replace('/components', '/hooks')

  // Transform @/registry/*/ui/* patterns (nuevo formato de shadcn)
  transformed = transformed.replace(
    /from ["']@\/registry\/[^/]+\/ui\/([^"']+)["']/g,
    `from "${componentsAlias}/$1"`
  )

  // Transform @/registry/*/hooks/*
  transformed = transformed.replace(
    /from ["']@\/registry\/[^/]+\/hooks\/([^"']+)["']/g,
    `from "${hooksAlias}/$1"`
  )

  // Transform @/registry/*/lib/*
  transformed = transformed.replace(
    /from ["']@\/registry\/[^/]+\/lib\/([^"']+)["']/g,
    `from "${libAlias}/$1"`
  )

  // Transform @/components/*
  transformed = transformed.replace(
    /from ["']@\/components\/([^"']+)["']/g,
    `from "${componentsAlias}/$1"`
  )

  // Transform @/lib/*
  transformed = transformed.replace(/from ["']@\/lib\/([^"']+)["']/g, `from "${libAlias}/$1"`)

  // Transform @/hooks/*
  transformed = transformed.replace(/from ["']@\/hooks\/([^"']+)["']/g, `from "${hooksAlias}/$1"`)

  return transformed
}

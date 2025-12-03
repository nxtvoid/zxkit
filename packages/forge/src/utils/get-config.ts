import { z } from 'zod'
import { cosmiconfig } from 'cosmiconfig'
import path from 'node:path'

const configSchema = z.object({
  $schema: z.string().optional(),
  style: z.string().default('new-york'),
  rsc: z.boolean().default(true),
  tsx: z.boolean().default(true),
  tailwind: z.object({
    config: z.string().optional(),
    css: z.string(),
    baseColor: z.string().default('neutral'),
    cssVariables: z.boolean().default(true),
  }),
  iconLibrary: z.string().default('lucide'),
  aliases: z.object({
    components: z.string(),
    utils: z.string(),
    hooks: z.string().optional(),
    lib: z.string().optional(),
    ui: z.string().optional(),
  }),
})

export type Config = z.infer<typeof configSchema>

export async function getConfig(uiPackagePath: string): Promise<Config | null> {
  const explorer = cosmiconfig('components', {
    searchPlaces: ['components.json'],
  })

  try {
    const result = await explorer.search(uiPackagePath)
    if (!result) {
      return null
    }

    return configSchema.parse(result.config)
  } catch {
    return null
  }
}

export function resolveConfigPaths(config: Config, uiPackagePath: string) {
  return {
    componentsPath: path.join(uiPackagePath, 'src', 'components'),
    hooksPath: path.join(uiPackagePath, 'src', 'hooks'),
    libPath: path.join(uiPackagePath, 'src', 'lib'),
    cssPath: path.join(uiPackagePath, config.tailwind.css),
  }
}

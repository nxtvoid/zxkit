import { z } from 'zod'

const REGISTRY_URL = 'https://ui.shadcn.com/r'

// Schema for registry items
const registryItemFileSchema = z.object({
  path: z.string(),
  content: z.string().optional(),
  type: z.enum([
    'registry:ui',
    'registry:lib',
    'registry:hook',
    'registry:component',
    'registry:block',
    'registry:page',
    'registry:file',
  ]),
  target: z.string().optional(),
})

const registryItemSchema = z.object({
  name: z.string(),
  type: z.enum([
    'registry:ui',
    'registry:lib',
    'registry:hook',
    'registry:component',
    'registry:block',
    'registry:page',
    'registry:style',
  ]),
  description: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
  registryDependencies: z.array(z.string()).optional(),
  files: z.array(registryItemFileSchema).optional(),
  tailwind: z
    .object({
      config: z.record(z.any()).optional(),
    })
    .optional(),
  cssVars: z.record(z.record(z.string())).optional(),
  meta: z.record(z.any()).optional(),
})

export type RegistryItem = z.infer<typeof registryItemSchema>
export type RegistryItemFile = z.infer<typeof registryItemFileSchema>

export type Style = 'default' | 'new-york'

export async function fetchRegistry(
  components: string[],
  style: Style = 'new-york'
): Promise<RegistryItem[]> {
  const items: RegistryItem[] = []

  for (const component of components) {
    const url = `${REGISTRY_URL}/styles/${style}/${component}.json`

    try {
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Component "${component}" not found in registry`)
      }

      const data = await response.json()
      const parsed = registryItemSchema.parse(data)
      items.push(parsed)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Failed to fetch component "${component}"`)
    }
  }

  return items
}

export async function resolveRegistryDependencies(
  items: RegistryItem[],
  style: Style = 'new-york'
): Promise<RegistryItem[]> {
  const resolved = new Map<string, RegistryItem>()
  const queue = [...items]

  while (queue.length > 0) {
    const item = queue.shift()!

    if (resolved.has(item.name)) {
      continue
    }

    resolved.set(item.name, item)

    // Fetch registry dependencies
    if (item.registryDependencies?.length) {
      for (const dep of item.registryDependencies) {
        if (!resolved.has(dep)) {
          const [depItem] = await fetchRegistry([dep], style)
          if (depItem) {
            queue.push(depItem)
          }
        }
      }
    }
  }

  return Array.from(resolved.values())
}

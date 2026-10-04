// Where the data folder lives, and how that choice is remembered. Pure
// functions take their inputs explicitly so they can be unit-tested; the
// Vite plugin feeds them the real environment.
import fs from 'node:fs'
import path from 'node:path'

export interface StorageConfig {
  dataDir?: string
}

export type DataDirSource = 'env' | 'config' | 'default'

/** `~` and relative paths are taken from the home directory; absolute paths pass through. */
export function expandPath(p: string, home: string): string {
  const t = p.trim()
  if (t === '~') return home
  if (t.startsWith('~/')) return path.join(home, t.slice(2))
  return path.isAbsolute(t) ? path.normalize(t) : path.join(home, t)
}

/** Precedence: MINI_ERP_DATA_DIR → config file → ./data next to the project. */
export function resolveDataDir({
  env,
  config,
  home,
  cwd,
}: {
  env: string | undefined
  config: StorageConfig
  home: string
  cwd: string
}): { dataDir: string; source: DataDirSource } {
  // The env var behaves like a shell path: relative to where the app was started.
  if (env?.trim()) {
    const t = env.trim()
    const expanded = t === '~' || t.startsWith('~/') ? expandPath(t, home) : path.resolve(cwd, t)
    return { dataDir: expanded, source: 'env' }
  }
  if (config.dataDir?.trim()) return { dataDir: expandPath(config.dataDir, home), source: 'config' }
  return { dataDir: path.resolve(cwd, 'data'), source: 'default' }
}

/** True when `child` is `parent` itself or lives anywhere below it. */
export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function configFile(configDir: string): string {
  return path.join(configDir, 'config.json')
}

export function readConfig(configDir: string): StorageConfig {
  try {
    const parsed = JSON.parse(fs.readFileSync(configFile(configDir), 'utf8'))
    return parsed && typeof parsed === 'object' && typeof parsed.dataDir === 'string' ? { dataDir: parsed.dataDir } : {}
  } catch {
    return {}
  }
}

export function writeConfig(configDir: string, config: StorageConfig): void {
  fs.mkdirSync(configDir, { recursive: true })
  const file = configFile(configDir)
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n')
  fs.renameSync(tmp, file)
}

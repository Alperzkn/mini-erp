// Talks to the local server about where the data folder is.

export interface StorageInfo {
  /** Absolute path of the folder in use. */
  dataDir: string
  /** How it was chosen: the environment variable, the Admin setting, or the default. */
  source: 'env' | 'config' | 'default'
  /** Whether that folder already holds a database file. */
  hasDb: boolean
  /** The folder used when nothing is configured. */
  defaultDir: string
}

export type StorageMode = 'move' | 'use'

async function parse(res: Response): Promise<StorageInfo> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body as StorageInfo
}

export function getStorage(): Promise<StorageInfo> {
  return fetch('/api/storage').then(parse)
}

/** `move` copies the current data to `dataDir` first; `use` just switches to it. */
export function setStorage(dataDir: string, mode: StorageMode): Promise<StorageInfo> {
  return fetch('/api/storage', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataDir, mode }),
  }).then(parse)
}

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { CSV_EXPORTS } from '../src/lib/csv.ts'
import { normalize } from '../src/lib/migrate.ts'
import { expandPath, readConfig, resolveDataDir, writeConfig, type DataDirSource } from './storage.ts'

// The whole database is one JSON file. The app loads it on start and writes
// it back after every change. Each day's first write also keeps a copy of
// the previous state in <data>/backups/, and every write refreshes a set of
// CSV files in <data>/csv/ for spreadsheets.
//
// The data folder is MINI_ERP_DATA_DIR, else the folder saved from Admin in
// ~/.config/mini-erp/config.json, else ./data. It is resolved on every request
// so a change made in Admin applies without restarting the server.
const CONFIG_DIR = process.env.MINI_ERP_CONFIG_DIR || path.join(os.homedir(), '.config', 'mini-erp')
const MAX_BODY_BYTES = 50 * 1024 * 1024

interface Dirs {
  dataDir: string
  source: DataDirSource
  dbFile: string
  backupDir: string
  csvDir: string
}

function dirs(): Dirs {
  const { dataDir, source } = resolveDataDir({
    env: process.env.MINI_ERP_DATA_DIR,
    config: readConfig(CONFIG_DIR),
    home: os.homedir(),
    cwd: process.cwd(),
  })
  return {
    dataDir,
    source,
    dbFile: path.join(dataDir, 'db.json'),
    backupDir: path.join(dataDir, 'backups'),
    csvDir: path.join(dataDir, 'csv'),
  }
}

function readDb(d: Dirs): string | null {
  return fs.existsSync(d.dbFile) ? fs.readFileSync(d.dbFile, 'utf8') : null
}

function backupOncePerDay(d: Dirs) {
  if (!fs.existsSync(d.dbFile)) return
  fs.mkdirSync(d.backupDir, { recursive: true })
  const day = new Date().toISOString().slice(0, 10)
  const target = path.join(d.backupDir, `db-${day}.json`)
  if (!fs.existsSync(target)) fs.copyFileSync(d.dbFile, target)
}

function writeDb(d: Dirs, json: string) {
  fs.mkdirSync(d.dataDir, { recursive: true })
  backupOncePerDay(d)
  writeAtomic(d.dbFile, json)
}

function writeAtomic(file: string, content: string) {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, content)
  fs.renameSync(tmp, file)
}

function writeCsvMirror(d: Dirs, raw: unknown) {
  try {
    const db = normalize(raw)
    fs.mkdirSync(d.csvDir, { recursive: true })
    for (const { file, build } of CSV_EXPORTS) writeAtomic(path.join(d.csvDir, file), build(db))
  } catch (err) {
    // The JSON file is the source of truth; a CSV hiccup must not fail the save.
    console.error('[mini-erp] Could not write CSV files:', err)
  }
}

function storageInfo(d: Dirs) {
  return {
    dataDir: d.dataDir,
    source: d.source,
    hasDb: fs.existsSync(d.dbFile),
    defaultDir: path.resolve(process.cwd(), 'data'),
  }
}

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Switches the data folder, optionally copying the current data there first. */
function changeStorage(current: Dirs, body: { dataDir?: unknown; mode?: unknown }): Dirs {
  if (current.source === 'env') {
    throw new HttpError(409, 'The folder is set by MINI_ERP_DATA_DIR. Unset it to change the folder here.')
  }
  if (typeof body.dataDir !== 'string' || !body.dataDir.trim()) throw new HttpError(400, 'Enter a folder path.')
  if (body.mode !== 'move' && body.mode !== 'use') throw new HttpError(400, 'Mode must be "move" or "use".')
  const target = expandPath(body.dataDir, os.homedir())
  if (path.resolve(target) === path.resolve(current.dataDir)) {
    throw new HttpError(400, 'That is already the folder in use.')
  }
  const targetDb = path.join(target, 'db.json')
  if (body.mode === 'move') {
    if (fs.existsSync(targetDb)) {
      throw new HttpError(409, 'That folder already has a database. Choose "Use this folder" to switch to it instead.')
    }
    fs.mkdirSync(target, { recursive: true })
    if (fs.existsSync(current.dbFile)) fs.copyFileSync(current.dbFile, targetDb)
    for (const sub of ['backups', 'csv']) {
      const from = path.join(current.dataDir, sub)
      if (fs.existsSync(from)) fs.cpSync(from, path.join(target, sub), { recursive: true })
    }
  } else {
    fs.mkdirSync(target, { recursive: true })
  }
  writeConfig(CONFIG_DIR, { dataDir: target })
  return dirs()
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: string) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

const handler: Connect.NextHandleFunction = async (req, res, next) => {
  if (req.url !== '/api/db' && req.url !== '/api/storage') return next()
  try {
    const d = dirs()
    if (req.url === '/api/storage') {
      if (req.method === 'GET') return send(res, 200, JSON.stringify(storageInfo(d)))
      if (req.method === 'PUT') {
        const body = JSON.parse(await readBody(req))
        return send(res, 200, JSON.stringify(storageInfo(changeStorage(d, body ?? {}))))
      }
      return send(res, 405, JSON.stringify({ error: 'Method not allowed' }))
    }
    if (req.method === 'GET') {
      return send(res, 200, readDb(d) ?? 'null')
    }
    if (req.method === 'PUT') {
      const body = await readBody(req)
      const parsed = JSON.parse(body)
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sales)) {
        return send(res, 400, JSON.stringify({ error: 'Invalid database payload' }))
      }
      writeDb(d, JSON.stringify(parsed, null, 2))
      writeCsvMirror(d, parsed)
      return send(res, 200, JSON.stringify({ ok: true }))
    }
    return send(res, 405, JSON.stringify({ error: 'Method not allowed' }))
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    return send(res, status, JSON.stringify({ error: (err as Error).message }))
  }
}

export function jsonDbPlugin(): Plugin {
  return {
    name: 'mini-erp-json-db',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

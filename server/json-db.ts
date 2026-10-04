import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { CSV_EXPORTS } from '../src/lib/csv.ts'
import { normalize } from '../src/lib/migrate.ts'

// The whole database is one JSON file. The app loads it on start and writes
// it back after every change. Each day's first write also keeps a copy of
// the previous state in data/backups/, and every write refreshes a set of
// CSV files in data/csv/ for spreadsheets.
const DATA_DIR = path.resolve(process.env.MINI_ERP_DATA_DIR ?? 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')
const CSV_DIR = path.join(DATA_DIR, 'csv')
const MAX_BODY_BYTES = 50 * 1024 * 1024

function readDb(): string | null {
  return fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE, 'utf8') : null
}

function backupOncePerDay() {
  if (!fs.existsSync(DB_FILE)) return
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const day = new Date().toISOString().slice(0, 10)
  const target = path.join(BACKUP_DIR, `db-${day}.json`)
  if (!fs.existsSync(target)) fs.copyFileSync(DB_FILE, target)
}

function writeDb(json: string) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  backupOncePerDay()
  writeAtomic(DB_FILE, json)
}

function writeAtomic(file: string, content: string) {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, content)
  fs.renameSync(tmp, file)
}

function writeCsvMirror(raw: unknown) {
  try {
    const db = normalize(raw)
    fs.mkdirSync(CSV_DIR, { recursive: true })
    for (const { file, build } of CSV_EXPORTS) writeAtomic(path.join(CSV_DIR, file), build(db))
  } catch (err) {
    // The JSON file is the source of truth; a CSV hiccup must not fail the save.
    console.error('[mini-erp] Could not write CSV files:', err)
  }
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
  if (req.url !== '/api/db') return next()
  try {
    if (req.method === 'GET') {
      return send(res, 200, readDb() ?? 'null')
    }
    if (req.method === 'PUT') {
      const body = await readBody(req)
      const parsed = JSON.parse(body)
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sales)) {
        return send(res, 400, JSON.stringify({ error: 'Invalid database payload' }))
      }
      writeDb(JSON.stringify(parsed, null, 2))
      writeCsvMirror(parsed)
      return send(res, 200, JSON.stringify({ ok: true }))
    }
    return send(res, 405, JSON.stringify({ error: 'Method not allowed' }))
  } catch (err) {
    return send(res, 500, JSON.stringify({ error: (err as Error).message }))
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

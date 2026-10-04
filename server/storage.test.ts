import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { expandPath, isInside, readConfig, resolveDataDir, writeConfig } from './storage.ts'

const home = '/Users/someone'
const cwd = '/Users/someone/dev/erp'
const tmp: string[] = []
afterEach(() => {
  for (const t of tmp.splice(0)) fs.rmSync(t, { recursive: true, force: true })
})

describe('expandPath', () => {
  it('expands ~ and makes relative paths absolute from home', () => {
    expect(expandPath('~/erp', home)).toBe('/Users/someone/erp')
    expect(expandPath('~', home)).toBe('/Users/someone')
    expect(expandPath('Dropbox/erp', home)).toBe('/Users/someone/Dropbox/erp')
    expect(expandPath('/Volumes/x/erp', home)).toBe('/Volumes/x/erp')
  })
})

describe('resolveDataDir', () => {
  it('env wins over config over default', () => {
    expect(resolveDataDir({ env: '/e', config: { dataDir: '/c' }, home, cwd })).toEqual({
      dataDir: '/e',
      source: 'env',
    })
    expect(resolveDataDir({ env: undefined, config: { dataDir: '/c' }, home, cwd })).toEqual({
      dataDir: '/c',
      source: 'config',
    })
    expect(resolveDataDir({ env: undefined, config: {}, home, cwd })).toEqual({
      dataDir: '/Users/someone/dev/erp/data',
      source: 'default',
    })
  })
  it('resolves a relative env value from the working directory, like a shell would', () => {
    expect(resolveDataDir({ env: 'data-test', config: {}, home, cwd }).dataDir).toBe('/Users/someone/dev/erp/data-test')
  })
  it('expands ~ in both env and config values', () => {
    expect(resolveDataDir({ env: '~/e', config: {}, home, cwd }).dataDir).toBe('/Users/someone/e')
    expect(resolveDataDir({ env: undefined, config: { dataDir: '~/c' }, home, cwd }).dataDir).toBe('/Users/someone/c')
  })
})

describe('config file', () => {
  it('round-trips and tolerates a missing or broken file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-erp-cfg-'))
    tmp.push(dir)
    expect(readConfig(dir)).toEqual({})
    writeConfig(dir, { dataDir: '/x' })
    expect(readConfig(dir)).toEqual({ dataDir: '/x' })
    fs.writeFileSync(path.join(dir, 'config.json'), '{not json')
    expect(readConfig(dir)).toEqual({})
  })
})

describe('isInside', () => {
  it('is true for the folder itself and its descendants only', () => {
    expect(isInside('/a/b', '/a/b')).toBe(true)
    expect(isInside('/a/b', '/a/b/backups/new')).toBe(true)
    expect(isInside('/a/b', '/a/bc')).toBe(false)
    expect(isInside('/a/b', '/a')).toBe(false)
  })
})

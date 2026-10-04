// Sale numbers come from a pattern such as "S-{YYYY}-{####}". Date tokens are
// filled from the sale date; the run of # is a zero-padded sequence derived
// from the sales that already share the same rendered prefix and suffix, so
// the sequence restarts on its own whenever a date token changes.
import type { Sale } from './types'

export const DEFAULT_SALE_NUMBER_FORMAT = 'S-{YYYY}-{####}'
const RUN = /\{(#{1,8})\}/g

function safeDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    if (d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])) return d
  }
  return new Date()
}

function fillDate(text: string, d: Date): string {
  const yyyy = String(d.getFullYear())
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return text
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yyyy.slice(2))
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
}

/** Returns null when the format is usable, otherwise a message for the user. */
export function validateFormat(format: string): string | null {
  if (!format.trim()) return 'The format cannot be empty.'
  const runs = format.match(RUN) ?? []
  if (runs.length > 1) return 'Use only one {####} sequence.'
  return null
}

/** The literal text around the sequence for a given sale date, and how wide the sequence is. */
export function renderParts(format: string, date: string): { prefix: string; suffix: string; width: number } {
  const d = safeDate(date)
  const runs = [...format.matchAll(RUN)]
  if (runs.length === 0) return { prefix: fillDate(format, d), suffix: '', width: 4 }
  const [run] = runs
  const at = run.index ?? 0
  return {
    prefix: fillDate(format.slice(0, at), d),
    suffix: fillDate(format.slice(at + run[0].length), d),
    width: run[1].length,
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function nextSaleNumber(format: string, date: string, sales: Pick<Sale, 'number'>[]): string {
  const { prefix, suffix, width } = renderParts(format, date)
  const re = new RegExp(`^${escapeRe(prefix)}(\\d+)${escapeRe(suffix)}$`)
  let max = 0
  for (const s of sales) {
    const m = re.exec(s.number)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}${String(max + 1).padStart(width, '0')}${suffix}`
}

export function isSaleNumberTaken(number: string, sales: Pick<Sale, 'id' | 'number'>[], excludeId?: string): boolean {
  const n = number.trim()
  return sales.some((s) => s.id !== excludeId && s.number === n)
}

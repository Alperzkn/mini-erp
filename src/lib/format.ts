import type { Sale, SaleItem } from './types'

export function uid(): string {
  return crypto.randomUUID()
}

export function today(): string {
  return toIsoDate(new Date())
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parses YYYY-MM-DD as a local date (not UTC). */
export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addMonths(iso: string, months: number): string {
  const d = parseIsoDate(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return toIsoDate(d)
}

export function daysUntil(iso: string): number {
  const ms = parseIsoDate(iso).getTime() - parseIsoDate(today()).getTime()
  return Math.round(ms / 86_400_000)
}

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  return parseIsoDate(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function itemTotal(item: SaleItem): number {
  return (item.quantity || 0) * (item.unitPrice || 0)
}

export function saleSubtotal(sale: Pick<Sale, 'items'>): number {
  return sale.items.reduce((sum, i) => sum + itemTotal(i), 0)
}

export function saleTotal(sale: Pick<Sale, 'items' | 'discount'>): number {
  return Math.max(0, saleSubtotal(sale) - (sale.discount || 0))
}

/** Revenue counts paid and pending sales; cancelled sales are ignored. */
export function countsAsRevenue(sale: Sale): boolean {
  return sale.status !== 'cancelled'
}

function monthsBetween(fromIso: string, toIso: string): number {
  const a = parseIsoDate(fromIso)
  const b = parseIsoDate(toIso)
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

/** Prefill for a new sale that renews `sale` on its renewal date. */
export function renewalOf(sale: Sale): Partial<Sale> {
  const date = sale.renewalDate ?? today()
  const period = sale.renewalDate ? Math.max(1, monthsBetween(sale.date, sale.renewalDate)) : 12
  return {
    customerId: sale.customerId,
    date,
    items: sale.items.map((i) => ({ ...i, id: uid() })),
    discount: sale.discount,
    status: 'pending',
    paidDate: undefined,
    paymentMethod: sale.paymentMethod,
    renewalDate: addMonths(date, period),
    renewsSaleId: sale.id,
    notes: `Renewal of ${sale.number}`,
  }
}

export interface UpcomingRenewal {
  sale: Sale
  days: number
}

/** Sales with a renewal date that hasn't been renewed yet, soonest first. */
export function openRenewals(sales: Sale[]): UpcomingRenewal[] {
  const renewed = new Set(sales.map((s) => s.renewsSaleId).filter(Boolean))
  return sales
    .filter((s) => s.renewalDate && s.status !== 'cancelled' && !renewed.has(s.id))
    .map((sale) => ({ sale, days: daysUntil(sale.renewalDate!) }))
    .sort((a, b) => a.days - b.days)
}

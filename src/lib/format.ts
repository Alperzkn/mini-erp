import type { Contact, Customer, Currency, Rates, Sale, SaleItem, Settings } from './types.ts'

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

export function formatMoney(amount: number, currency: Currency): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function formatCompactMoney(amount: number, currency: Currency): string {
  try {
    return new Intl.NumberFormat(undefined, { notation: 'compact', style: 'currency', currency }).format(amount)
  } catch {
    return `${Math.round(amount)} ${currency}`
  }
}

export function formatRate(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 6 }).format(n)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Currencies you work with: the ones that have a rate. */
export function currencyList(settings: Settings): Currency[] {
  return Object.keys(settings.rates)
}

export function convert(amount: number, from: Currency, to: Currency, rates: Rates): number {
  if (from === to) return amount
  const rf = rates[from]
  const rt = rates[to]
  if (!rf || !rt) return amount
  return (amount * rt) / rf
}

/** How many `to` you get for 1 `from`. */
export function pairRate(from: Currency, to: Currency, rates: Rates): number {
  return convert(1, from, to, rates)
}

export type RateMode = 'sale' | 'current'

/** Rates to use for a sale: the ones saved with it, or today's from Admin. */
export function ratesForSale(sale: Sale, settings: Settings, mode: RateMode = 'sale'): Rates {
  if (mode === 'sale' && sale.fx && sale.fx[sale.currency] && sale.fx[settings.baseCurrency]) {
    return sale.fx
  }
  return settings.rates
}

/** Sale total converted to `target` (the base currency by default). */
export function saleTotalIn(
  sale: Sale,
  settings: Settings,
  mode: RateMode = 'sale',
  target: Currency = settings.baseCurrency,
): number {
  const rates = ratesForSale(sale, settings, mode)
  // Saved rates may lack a newer currency; fall back to today's for that one.
  const r = rates[target] ? rates : settings.rates
  return convert(saleTotal(sale), sale.currency, target, r)
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
    contactId: sale.contactId,
    date,
    items: sale.items.map((i) => ({ ...i, id: uid() })),
    discount: sale.discount,
    currency: sale.currency,
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

/** The main person at a company: the one marked primary, else the first. */
export function primaryContact(c: Customer): Contact | undefined {
  return c.contacts.find((p) => p.primary) ?? c.contacts[0]
}

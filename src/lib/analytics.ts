import {
  countsAsRevenue,
  itemTotal,
  ratesForSale,
  saleSubtotal,
  saleTotal,
  saleTotalIn,
  convert,
  type RateMode,
} from './format.ts'
import type { Currency, Db, ProductType, Sale } from './types.ts'

export interface Bucket {
  key: string
  label: string
  revenue: number
  count: number
}

function addTo(map: Map<string, Bucket>, key: string, label: string, revenue: number, count = 1) {
  const b = map.get(key) ?? { key, label, revenue: 0, count: 0 }
  b.revenue += revenue
  b.count += count
  map.set(key, b)
}

function sorted(map: Map<string, Bucket>): Bucket[] {
  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

/**
 * Each line's share of the sale total, in `target` currency. The discount is
 * spread over lines by value, so line shares always add up to the sale total.
 */
export function lineShares(sale: Sale, db: Db, mode: RateMode, target: Currency) {
  const subtotal = saleSubtotal(sale)
  const factor = subtotal > 0 ? saleTotal(sale) / subtotal : 0
  const rates = ratesForSale(sale, db.settings, mode)
  const r = rates[target] ? rates : db.settings.rates
  return sale.items.map((item) => ({
    item,
    amount: convert(itemTotal(item) * factor, sale.currency, target, r),
  }))
}

export interface Report {
  revenue: number
  paid: number
  outstanding: number
  count: number
  average: number
  byMonth: Bucket[]
  byProduct: Bucket[]
  byType: Bucket[]
  byCustomer: Bucket[]
  bySalesperson: Bucket[]
  /** Totals in each sale's own currency (not converted). */
  byCurrency: Bucket[]
}

const TYPE_LABELS: Record<ProductType | 'custom', string> = {
  license: 'License',
  subscription: 'Subscription',
  service: 'Service / Consulting',
  support: 'Support / Maintenance',
  other: 'Other',
  custom: 'Custom items',
}

/** Revenue breakdowns over the given sales (cancelled sales are skipped). */
export function buildReport(sales: Sale[], db: Db, mode: RateMode, target: Currency): Report {
  const products = new Map(db.products.map((p) => [p.id, p]))
  const customers = new Map(db.customers.map((c) => [c.id, c]))
  const byMonth = new Map<string, Bucket>()
  const byProduct = new Map<string, Bucket>()
  const byType = new Map<string, Bucket>()
  const byCustomer = new Map<string, Bucket>()
  const bySalesperson = new Map<string, Bucket>()
  const reps = new Map(db.salespeople.map((p) => [p.id, p]))
  const byCurrency = new Map<string, Bucket>()
  let revenue = 0
  let paid = 0
  let count = 0

  for (const sale of sales) {
    if (!countsAsRevenue(sale)) continue
    const total = saleTotalIn(sale, db.settings, mode, target)
    revenue += total
    if (sale.status === 'paid') paid += total
    count += 1

    const month = sale.date.slice(0, 7)
    addTo(byMonth, month, month, total)
    const c = customers.get(sale.customerId)
    addTo(byCustomer, sale.customerId, c?.name ?? 'Unknown customer', total)
    const rep = sale.salespersonId ? reps.get(sale.salespersonId) : undefined
    addTo(bySalesperson, rep?.id ?? 'none', rep?.name ?? 'No rep', total)
    addTo(byCurrency, sale.currency, sale.currency, saleTotal(sale))

    for (const { item, amount } of lineShares(sale, db, mode, target)) {
      const p = item.productId ? products.get(item.productId) : undefined
      if (p) addTo(byProduct, p.id, p.name, amount, item.quantity)
      else addTo(byProduct, 'custom', 'Custom items', amount, item.quantity)
      const type = p?.type ?? 'custom'
      addTo(byType, type, TYPE_LABELS[type], amount, item.quantity)
    }
  }

  return {
    revenue,
    paid,
    outstanding: revenue - paid,
    count,
    average: count ? revenue / count : 0,
    byMonth: [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)),
    byProduct: sorted(byProduct),
    byType: sorted(byType),
    byCustomer: sorted(byCustomer),
    bySalesperson: sorted(bySalesperson),
    byCurrency: sorted(byCurrency),
  }
}

/** Month keys (YYYY-MM) from `from` to `to`, inclusive. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.slice(0, 7).split('-').map(Number)
  const [ty, tm] = to.slice(0, 7).split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

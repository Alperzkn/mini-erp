import { DEFAULT_RATES, emptyDb, type Db, type Rates } from './types.ts'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Brings any older or hand-edited data file up to the current shape.
 * Version 1 had a single `settings.currency` and no events.
 */
export function normalize(raw: any): Db {
  const base = emptyDb()
  if (!raw || typeof raw !== 'object') return base
  const s = raw.settings ?? {}
  const legacyCurrency: string | undefined = s.currency
  const baseCurrency: string = s.baseCurrency ?? legacyCurrency ?? base.settings.baseCurrency
  const rates: Rates = { ...(s.rates ?? DEFAULT_RATES) }
  if (!rates[baseCurrency]) rates[baseCurrency] = 1
  const fallback = legacyCurrency ?? baseCurrency

  return {
    version: 2,
    settings: {
      businessName: s.businessName ?? base.settings.businessName,
      baseCurrency,
      rates,
      ratesUpdatedAt: s.ratesUpdatedAt,
      salePrefix: s.salePrefix ?? base.settings.salePrefix,
      nextSaleNumber: s.nextSaleNumber ?? base.settings.nextSaleNumber,
    },
    customers: raw.customers ?? [],
    products: (raw.products ?? []).map((p: any) => ({ ...p, currency: p.currency ?? fallback })),
    sales: (raw.sales ?? []).map((x: any) => ({
      ...x,
      currency: x.currency ?? fallback,
      events: x.events ?? [],
    })),
  }
}

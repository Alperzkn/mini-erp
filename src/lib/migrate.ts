import { DEFAULT_SALE_NUMBER_FORMAT } from './sale-number.ts'
import { DEFAULT_RATES, emptyDb, type Contact, type Customer, type Db, type Rates } from './types.ts'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Version 2 customers were people with an optional company. Version 3 makes the
 * company the customer and keeps the person as its primary contact.
 */
function migrateCustomer(c: any): Customer {
  if (Array.isArray(c.contacts)) return c
  const person: Contact = {
    id: `${c.id}-p`,
    name: c.name ?? '',
    primary: true,
    createdAt: c.createdAt ?? new Date().toISOString(),
    ...(c.email ? { email: c.email } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
  }
  const { company, email, phone, ...rest } = c
  if (company) {
    return { ...rest, name: company, contacts: person.name ? [person] : [] }
  }
  return {
    ...rest,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    contacts: [person],
  }
}

/**
 * Brings any older or hand-edited data file up to the current shape.
 * Version 1 had a single `settings.currency` and no events.
 * Version 2 had person-customers and a prefix + counter for sale numbers.
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
    version: 3,
    settings: {
      businessName: s.businessName ?? base.settings.businessName,
      baseCurrency,
      rates,
      ratesUpdatedAt: s.ratesUpdatedAt,
      // A legacy prefix keeps old numbers looking the same.
      saleNumberFormat:
        s.saleNumberFormat ?? (s.salePrefix ? `${s.salePrefix}{####}` : DEFAULT_SALE_NUMBER_FORMAT),
    },
    customers: (raw.customers ?? []).map(migrateCustomer),
    products: (raw.products ?? []).map((p: any) => ({ ...p, currency: p.currency ?? fallback })),
    sales: (raw.sales ?? []).map((x: any) => ({
      ...x,
      currency: x.currency ?? fallback,
      events: x.events ?? [],
    })),
  }
}

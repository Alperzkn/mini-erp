export type ProductType = 'license' | 'subscription' | 'service' | 'support' | 'other'
export type Billing = 'one-time' | 'monthly' | 'yearly'
export type SaleStatus = 'paid' | 'pending' | 'cancelled'
/** ISO 4217 code, e.g. USD, EUR, TRY. */
export type Currency = string
export type EventType =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'invoice'
  | 'payment'
  | 'delivery'
  | 'support'
  | 'system'

/**
 * Exchange rates as "units of each currency per one common unit". Only the
 * ratio between two entries matters: amount × rates[to] / rates[from].
 */
export type Rates = Record<Currency, number>

export interface Customer {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  country?: string
  taxId?: string
  /** Preselected currency for this customer's new sales. */
  currency?: Currency
  notes?: string
  createdAt: string
}

export interface Product {
  id: string
  name: string
  type: ProductType
  billing: Billing
  price: number
  currency: Currency
  description?: string
  active: boolean
  createdAt: string
}

export interface SaleItem {
  id: string
  productId?: string
  description: string
  quantity: number
  unitPrice: number
}

export interface SaleEvent {
  id: string
  /** YYYY-MM-DD, when it happened */
  date: string
  type: EventType
  note: string
  createdAt: string
}

export interface Sale {
  id: string
  number: string
  customerId: string
  /** YYYY-MM-DD */
  date: string
  currency: Currency
  /** Exchange rates when the sale was made. Missing on very old records. */
  fx?: Rates
  items: SaleItem[]
  discount: number
  status: SaleStatus
  /** YYYY-MM-DD */
  paidDate?: string
  paymentMethod?: string
  /** YYYY-MM-DD, for subscriptions / licenses that need renewing */
  renewalDate?: string
  /** Set when this sale is the renewal of an earlier sale. */
  renewsSaleId?: string
  notes?: string
  events: SaleEvent[]
  createdAt: string
  updatedAt: string
}

export interface Settings {
  businessName: string
  /** Currency that dashboards and reports are shown in. */
  baseCurrency: Currency
  rates: Rates
  /** ISO timestamp of the last time rates were edited. */
  ratesUpdatedAt?: string
  salePrefix: string
  nextSaleNumber: number
}

export interface Db {
  version: 2
  settings: Settings
  customers: Customer[]
  products: Product[]
  sales: Sale[]
}

export const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'license', label: 'License' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'service', label: 'Service / Consulting' },
  { value: 'support', label: 'Support / Maintenance' },
  { value: 'other', label: 'Other' },
]

export const BILLINGS: { value: Billing; label: string }[] = [
  { value: 'one-time', label: 'One-time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export const SALE_STATUSES: { value: SaleStatus; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
]

/** Event types you can add by hand. 'system' entries are written by the app. */
export const EVENT_TYPES: { value: Exclude<EventType, 'system'>; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'invoice', label: 'Invoice sent' },
  { value: 'payment', label: 'Payment' },
  { value: 'delivery', label: 'License / delivery' },
  { value: 'support', label: 'Support' },
]

export const EVENT_LABELS: Record<EventType, string> = {
  ...Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.label])),
  system: 'Update',
} as Record<EventType, string>

/** Placeholder rates (per 1 USD) until you enter real ones in Admin. */
export const DEFAULT_RATES: Rates = { USD: 1, EUR: 0.86, TRY: 41.5 }

export function emptyDb(): Db {
  return {
    version: 2,
    settings: {
      businessName: 'My Software Business',
      baseCurrency: 'USD',
      rates: { ...DEFAULT_RATES },
      salePrefix: 'S-',
      nextSaleNumber: 1,
    },
    customers: [],
    products: [],
    sales: [],
  }
}

export type ProductType = 'license' | 'subscription' | 'service' | 'support' | 'other'
export type Billing = 'one-time' | 'monthly' | 'yearly'
export type SaleStatus = 'paid' | 'pending' | 'cancelled'

export interface Customer {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  country?: string
  taxId?: string
  notes?: string
  createdAt: string
}

export interface Product {
  id: string
  name: string
  type: ProductType
  billing: Billing
  price: number
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

export interface Sale {
  id: string
  number: string
  customerId: string
  /** YYYY-MM-DD */
  date: string
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
  createdAt: string
  updatedAt: string
}

export interface Settings {
  businessName: string
  currency: string
  salePrefix: string
  nextSaleNumber: number
}

export interface Db {
  version: 1
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

export function emptyDb(): Db {
  return {
    version: 1,
    settings: {
      businessName: 'My Software Business',
      currency: 'USD',
      salePrefix: 'S-',
      nextSaleNumber: 1,
    },
    customers: [],
    products: [],
    sales: [],
  }
}

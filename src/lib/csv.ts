// CSV builders shared by the browser (downloads) and the local server (which
// mirrors every save into data/csv/). Keep this file free of browser APIs.
import { lineShares } from './analytics.ts'
import { itemTotal, pairRate, primaryContact, ratesForSale, saleSubtotal, saleTotal, saleTotalIn } from './format.ts'
import type { Db } from './types.ts'

/** Excel needs a BOM to read UTF-8 (ş, ğ, ü, €...) correctly. */
const BOM = '﻿'

function cell(v: unknown): string {
  if (v == null) return ''
  const s = typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: unknown[][]): string {
  return BOM + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

function bySaleDate(db: Db) {
  return [...db.sales].sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))
}

export function salesCsv(db: Db): string {
  const base = db.settings.baseCurrency
  const customers = new Map(db.customers.map((c) => [c.id, c]))
  const numbers = new Map(db.sales.map((s) => [s.id, s.number]))
  const rows = bySaleDate(db).map((s) => {
    const c = customers.get(s.customerId)
    return [
      s.number,
      s.date,
      c?.name,
      c?.contacts.find((p) => p.id === s.contactId)?.name,
      s.currency,
      saleSubtotal(s),
      s.discount || 0,
      saleTotal(s),
      pairRate(s.currency, base, ratesForSale(s, db.settings)),
      saleTotalIn(s, db.settings),
      s.status,
      s.paidDate,
      s.paymentMethod,
      s.renewalDate,
      s.renewsSaleId ? numbers.get(s.renewsSaleId) : '',
      s.items.map((i) => `${i.quantity} x ${i.description}`).join('; '),
      s.events.length,
      s.notes,
    ]
  })
  return toCsv([
    [
      'Number',
      'Date',
      'Customer',
      'Contact',
      'Currency',
      'Subtotal',
      'Discount',
      'Total',
      `Rate to ${base}`,
      `Total in ${base}`,
      'Status',
      'Paid date',
      'Payment method',
      'Renewal date',
      'Renews sale',
      'Items',
      'Events',
      'Notes',
    ],
    ...rows,
  ])
}

export function saleItemsCsv(db: Db): string {
  const base = db.settings.baseCurrency
  const customers = new Map(db.customers.map((c) => [c.id, c]))
  const products = new Map(db.products.map((p) => [p.id, p]))
  const rows = bySaleDate(db).flatMap((s) =>
    lineShares(s, db, 'sale', base).map(({ item, amount }) => {
      const p = item.productId ? products.get(item.productId) : undefined
      return [
        s.number,
        s.date,
        customers.get(s.customerId)?.name,
        s.status,
        p?.name ?? '',
        p?.type ?? 'custom',
        item.description,
        item.quantity,
        item.unitPrice,
        s.currency,
        itemTotal(item),
        s.status === 'cancelled' ? 0 : amount,
      ]
    }),
  )
  return toCsv([
    [
      'Sale',
      'Date',
      'Customer',
      'Status',
      'Product',
      'Product type',
      'Description',
      'Quantity',
      'Unit price',
      'Currency',
      'Line total',
      `Revenue in ${base} (after discount)`,
    ],
    ...rows,
  ])
}

export function eventsCsv(db: Db): string {
  const customers = new Map(db.customers.map((c) => [c.id, c]))
  const rows = bySaleDate(db).flatMap((s) =>
    [...s.events]
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
      .map((e) => [s.number, customers.get(s.customerId)?.name, e.date, e.type, e.note]),
  )
  return toCsv([['Sale', 'Customer', 'Date', 'Type', 'Note'], ...rows])
}

export function customersCsv(db: Db): string {
  const base = db.settings.baseCurrency
  const rows = [...db.customers]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => {
      const sales = db.sales.filter((s) => s.customerId === c.id && s.status !== 'cancelled')
      const revenue = sales.reduce((sum, s) => sum + saleTotalIn(s, db.settings), 0)
      const main = primaryContact(c)
      return [
        c.name,
        main?.name,
        main?.email,
        c.email,
        c.phone,
        c.website,
        c.country,
        c.taxId,
        c.currency,
        sales.length,
        revenue,
        c.createdAt.slice(0, 10),
        c.notes,
      ]
    })
  return toCsv([
    [
      'Company',
      'Primary contact',
      'Contact email',
      'Email',
      'Phone',
      'Website',
      'Country',
      'Tax ID',
      'Default currency',
      'Sales',
      `Revenue in ${base}`,
      'Created',
      'Notes',
    ],
    ...rows,
  ])
}

export function contactsCsv(db: Db): string {
  const rows = [...db.customers]
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((c) =>
      [...c.contacts]
        .sort((a, b) => Number(!!b.primary) - Number(!!a.primary) || a.name.localeCompare(b.name))
        .map((p) => [c.name, p.name, p.role, p.email, p.phone, p.primary ? 'yes' : 'no', p.notes]),
    )
  return toCsv([['Company', 'Name', 'Role', 'Email', 'Phone', 'Primary', 'Notes'], ...rows])
}

export function productsCsv(db: Db): string {
  const rows = [...db.products]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => [p.name, p.type, p.billing, p.price, p.currency, p.active ? 'yes' : 'no', p.description])
  return toCsv([['Name', 'Type', 'Billing', 'Price', 'Currency', 'Active', 'Description'], ...rows])
}

export const CSV_EXPORTS = [
  { file: 'sales.csv', label: 'Sales', build: salesCsv },
  { file: 'sale-items.csv', label: 'Sale items', build: saleItemsCsv },
  { file: 'events.csv', label: 'Order events', build: eventsCsv },
  { file: 'customers.csv', label: 'Customers', build: customersCsv },
  { file: 'contacts.csv', label: 'Contacts', build: contactsCsv },
  { file: 'products.csv', label: 'Products', build: productsCsv },
] as const

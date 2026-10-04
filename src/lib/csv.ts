import { saleTotal } from './format'
import type { Db } from './types'

function cell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function salesToCsv(db: Db): string {
  const customers = new Map(db.customers.map((c) => [c.id, c]))
  const header = [
    'Number', 'Date', 'Customer', 'Company', 'Items', 'Discount', 'Total', 'Currency',
    'Status', 'Paid date', 'Payment method', 'Renewal date', 'Notes',
  ]
  const rows = [...db.sales]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => {
      const c = customers.get(s.customerId)
      return [
        s.number, s.date, c?.name, c?.company,
        s.items.map((i) => `${i.quantity} x ${i.description} @ ${i.unitPrice}`).join('; '),
        s.discount || 0, saleTotal(s).toFixed(2), db.settings.currency,
        s.status, s.paidDate, s.paymentMethod, s.renewalDate, s.notes,
      ]
    })
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n')
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

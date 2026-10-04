import { useState } from 'react'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { CustomerDialog } from '@/components/customer-dialog'
import { Field } from '@/components/field'
import {
  addMonths,
  convert,
  currencyList,
  formatMoney,
  formatRate,
  itemTotal,
  pairRate,
  round2,
  saleSubtotal,
  saleTotal,
  today,
  uid,
} from '@/lib/format'
import { useStore } from '@/lib/store'
import { SALE_STATUSES, type Customer, type Sale, type SaleItem, type SaleStatus, type Settings } from '@/lib/types'

const CUSTOM = '__custom__'

function blankItem(): SaleItem {
  return { id: uid(), productId: '', description: '', quantity: 1, unitPrice: 0 }
}

function blankSale(settings: Settings): Sale {
  const now = new Date().toISOString()
  return {
    id: uid(),
    number: '',
    customerId: '',
    date: today(),
    currency: settings.baseCurrency,
    fx: { ...settings.rates },
    events: [],
    items: [blankItem()],
    discount: 0,
    status: 'paid',
    paidDate: today(),
    createdAt: now,
    updatedAt: now,
  }
}

export function SaleDialog({
  open,
  onOpenChange,
  sale,
  initial,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Existing sale to edit. */
  sale?: Sale
  /** Prefill values for a new sale (e.g. a customer, or a renewal). */
  initial?: Partial<Sale>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {open && <SaleForm sale={sale} initial={initial} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function SaleForm({
  sale,
  initial,
  onDone,
}: {
  sale?: Sale
  initial?: Partial<Sale>
  onDone: () => void
}) {
  const { db, upsertSale } = useStore()
  const { settings } = db
  const [form, setForm] = useState<Sale>(() => {
    if (sale) return { ...sale, fx: sale.fx ?? { ...settings.rates } }
    const customer = db.customers.find((c) => c.id === initial?.customerId)
    return {
      ...blankSale(settings),
      ...(customer?.currency && settings.rates[customer.currency] ? { currency: customer.currency } : {}),
      ...initial,
    }
  })
  const currency = form.currency
  const base = settings.baseCurrency
  const fx = form.fx ?? settings.rates
  const rateToBase = pairRate(currency, base, fx)
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)

  const set = <K extends keyof Sale>(k: K, v: Sale[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setItem = (id: string, patch: Partial<SaleItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))

  const customers = [...db.customers].sort((a, b) => a.name.localeCompare(b.name))
  const products = db.products.filter(
    (p) => p.active || form.items.some((i) => i.productId === p.id),
  )

  const pickProduct = (itemId: string, productId: string) => {
    if (productId === CUSTOM) {
      setItem(itemId, { productId: undefined })
      return
    }
    const p = db.products.find((x) => x.id === productId)
    if (!p) return
    setItem(itemId, {
      productId: p.id,
      description: p.name,
      unitPrice: round2(convert(p.price, p.currency, form.currency, settings.rates)),
    })
    // Recurring products suggest when the next renewal is due.
    if (!form.renewalDate && p.billing !== 'one-time') {
      set('renewalDate', addMonths(form.date, p.billing === 'monthly' ? 1 : 12))
    }
  }

  const applyCustomer = (c: Customer) =>
    setForm((f) => ({
      ...f,
      customerId: c.id,
      // New sales follow the customer's usual currency.
      currency: !sale && c.currency && settings.rates[c.currency] ? c.currency : f.currency,
    }))

  const pickCustomer = (id: string) => {
    const c = db.customers.find((x) => x.id === id)
    if (c) applyCustomer(c)
  }

  /** Edit "1 {currency} = x {base}" by scaling this sale's saved rate. */
  const setRateToBase = (x: number) => {
    if (!(x > 0)) return
    setForm((f) => {
      const r = { ...(f.fx ?? settings.rates) }
      r[f.currency] = r[base] / x
      return { ...f, fx: r }
    })
  }

  const setStatus = (status: SaleStatus) =>
    setForm((f) => ({
      ...f,
      status,
      paidDate: status === 'paid' ? (f.paidDate ?? today()) : undefined,
    }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerId) {
      toast.error('Pick a customer')
      return
    }
    const items = form.items
      .filter((i) => i.description.trim() || i.unitPrice)
      .map((i) => ({ ...i, description: i.description.trim() || 'Item' }))
    if (items.length === 0) {
      toast.error('Add at least one item')
      return
    }
    upsertSale({
      ...form,
      items,
      paymentMethod: form.paymentMethod?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      renewalDate: form.renewalDate || undefined,
      updatedAt: new Date().toISOString(),
    })
    toast.success(sale ? 'Sale updated' : 'Sale recorded')
    onDone()
  }

  return (
    <>
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{sale ? `Edit sale ${sale.number}` : 'New sale'}</DialogTitle>
        <DialogDescription>What you sold, to whom, for how much, and when.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Customer *" className="sm:col-span-2">
          <div className="flex gap-2">
            {/* Radix fires onValueChange('') when the option list changes (e.g. right
                after adding a customer); ignore it so the selection sticks. */}
            <Select value={form.customerId} onValueChange={(v) => v && pickCustomer(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={() => setNewCustomerOpen(true)}>
              <PlusIcon /> New
            </Button>
          </div>
        </Field>
        <Field label="Sale date" htmlFor="s-date">
          <Input id="s-date" type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Currency">
          <Select value={form.currency} onValueChange={(v) => v && set('currency', v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencyList(settings).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-medium">Items</div>
        <div className="text-muted-foreground hidden grid-cols-[1.2fr_1.5fr_70px_110px_100px_36px] gap-2 text-xs sm:grid">
          <span>Product</span>
          <span>Description</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span className="text-right">Total</span>
          <span />
        </div>
        {form.items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-2 items-center gap-2 rounded-md border p-2 sm:grid-cols-[1.2fr_1.5fr_70px_110px_100px_36px] sm:border-0 sm:p-0"
          >
            <Select value={item.productId ?? CUSTOM} onValueChange={(v) => pickProduct(item.id, v)}>
              <SelectTrigger className="col-span-2 w-full sm:col-span-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CUSTOM}>Custom item</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="col-span-2 sm:col-span-1"
              placeholder="Description"
              value={item.description}
              onChange={(e) => setItem(item.id, { description: e.target.value })}
            />
            <Input
              type="number"
              min="0"
              step="any"
              aria-label="Quantity"
              value={item.quantity}
              onChange={(e) => setItem(item.id, { quantity: e.target.valueAsNumber || 0 })}
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              aria-label="Unit price"
              value={item.unitPrice}
              onChange={(e) => setItem(item.id, { unitPrice: e.target.valueAsNumber || 0 })}
            />
            <div className="text-right text-sm tabular-nums">{formatMoney(itemTotal(item), currency)}</div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove item"
              disabled={form.items.length === 1}
              onClick={() => set('items', form.items.filter((i) => i.id !== item.id))}
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => set('items', [...form.items, blankItem()])}>
            <PlusIcon /> Add item
          </Button>
        </div>
      </div>

      <div className="ml-auto grid w-full max-w-xs gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatMoney(saleSubtotal(form), currency)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="s-discount" className="text-muted-foreground">
            Discount
          </label>
          <Input
            id="s-discount"
            type="number"
            min="0"
            step="0.01"
            className="h-8 w-28 text-right"
            value={form.discount}
            onChange={(e) => set('discount', e.target.valueAsNumber || 0)}
          />
        </div>
        <Separator className="my-1" />
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(saleTotal(form), currency)}</span>
        </div>
        {currency !== base && (
          <>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>In {base}</span>
              <span className="tabular-nums">{formatMoney(saleTotal(form) * rateToBase, base)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <label htmlFor="s-rate" className="text-muted-foreground text-xs whitespace-nowrap">
                Rate: 1 {currency} =
              </label>
              <div className="flex items-center gap-1">
                <Input
                  id="s-rate"
                  // Re-mount when the currency changes so the field shows the new pair.
                  key={currency}
                  type="number"
                  min="0"
                  step="any"
                  className="h-8 w-28 text-right"
                  defaultValue={Number(rateToBase.toPrecision(6))}
                  onChange={(e) => setRateToBase(e.target.valueAsNumber)}
                />
                <span className="text-muted-foreground text-xs">{base}</span>
              </div>
            </div>
            <p className="text-muted-foreground text-right text-xs">
              Today in Admin: 1 {currency} = {formatRate(pairRate(currency, base, settings.rates))} {base}
            </p>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => setStatus(v as SaleStatus)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SALE_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Paid on" htmlFor="s-paid">
          <Input
            id="s-paid"
            type="date"
            disabled={form.status !== 'paid'}
            value={form.paidDate ?? ''}
            onChange={(e) => set('paidDate', e.target.value || undefined)}
          />
        </Field>
        <Field label="Payment method" htmlFor="s-method">
          <Input
            id="s-method"
            placeholder="Bank transfer, Stripe…"
            list="payment-methods"
            value={form.paymentMethod ?? ''}
            onChange={(e) => set('paymentMethod', e.target.value)}
          />
          <datalist id="payment-methods">
            {[...new Set(db.sales.map((s) => s.paymentMethod).filter(Boolean))].map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label="Renewal date" htmlFor="s-renewal">
          <Input
            id="s-renewal"
            type="date"
            value={form.renewalDate ?? ''}
            onChange={(e) => set('renewalDate', e.target.value || undefined)}
          />
        </Field>
        <Field label="Notes" htmlFor="s-notes" className="sm:col-span-4">
          <Textarea
            id="s-notes"
            placeholder="License keys, contract reference, anything useful…"
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{sale ? 'Save changes' : 'Record sale'}</Button>
      </DialogFooter>
    </form>
    {/* Kept outside <form>: React bubbles submit events through portals. */}
    <CustomerDialog
      open={newCustomerOpen}
      onOpenChange={setNewCustomerOpen}
      onSaved={applyCustomer}
    />
    </>
  )
}

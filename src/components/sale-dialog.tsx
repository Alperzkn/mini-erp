import { useMemo, useState } from 'react'
import { PlusIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
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
import { Combobox } from '@/components/combobox'
import { NumberInput } from '@/components/number-input'
import { ContactDialog } from '@/components/contact-dialog'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { CustomerDialog } from '@/components/customer-dialog'
import { Field } from '@/components/field'
import { FormSection } from '@/components/form-section'
import {
  addMonths,
  convert,
  currencyList,
  daysBetween,
  formatMoney,
  formatRate,
  itemTotal,
  pairRate,
  primaryContact,
  round2,
  saleSubtotal,
  saleTotal,
  shiftDays,
  today,
  uid,
} from '@/lib/format'
import { pickLabel, type PickedItem } from '@/lib/picks'
import { isSaleNumberTaken, nextSaleNumber } from '@/lib/sale-number'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  SALE_STATUSES,
  type Contact,
  type Customer,
  type Sale,
  type SaleItem,
  type SaleStatus,
  type Settings,
} from '@/lib/types'

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
    items: [],
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
      <DialogContent className="sm:max-w-4xl">
        {open && <SaleForm sale={sale} initial={initial} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

type Errors = Record<string, string>

function SaleForm({ sale, initial, onDone }: { sale?: Sale; initial?: Partial<Sale>; onDone: () => void }) {
  const { db, upsertSale } = useStore()
  const { settings } = db
  const [form, setForm] = useState<Sale>(() => {
    if (sale) return { ...sale, fx: sale.fx ?? { ...settings.rates } }
    const customer = db.customers.find((c) => c.id === initial?.customerId)
    return {
      ...blankSale(settings),
      ...(customer?.currency && settings.rates[customer.currency] ? { currency: customer.currency } : {}),
      // A prefilled company brings its primary contact and rep along, like picking it in the form does.
      ...(customer ? { contactId: primaryContact(customer)?.id, salespersonId: customer.salespersonId } : {}),
      ...initial,
    }
  })
  const [errors, setErrors] = useState<Errors>({})
  // Once the number is edited by hand it stops following the date.
  const [numberTouched, setNumberTouched] = useState(!!sale)
  const [customerQuery, setCustomerQuery] = useState<string>()
  const [contactQuery, setContactQuery] = useState<string>()
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'replace'; itemId: string }>()

  const currency = form.currency
  const base = settings.baseCurrency
  const fx = form.fx ?? settings.rates
  const rateToBase = pairRate(currency, base, fx)

  const generated = useMemo(
    () => nextSaleNumber(settings.saleNumberFormat, form.date, db.sales),
    [settings.saleNumberFormat, form.date, db.sales],
  )
  // Until edited by hand, the number follows the sale date.
  const number = numberTouched ? form.number : generated

  const set = <K extends keyof Sale>(k: K, v: Sale[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setItem = (id: string, patch: Partial<SaleItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
  const clearError = (key: string) =>
    setErrors((e) => {
      if (!(key in e)) return e
      const { [key]: _, ...rest } = e
      return rest
    })

  const customer = db.customers.find((c) => c.id === form.customerId)
  const customerOptions = useMemo(
    () =>
      [...db.customers]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.name, hint: primaryContact(c)?.name })),
    [db.customers],
  )
  const contactOptions = (customer?.contacts ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.role }))
  /** Puts picked items on the sale: replacing one line, or appending after the last. */
  const applyPicks = (itemId: string | undefined, picks: PickedItem[]) => {
    if (picks.length === 0) return
    setForm((f) => {
      const idx = itemId ? f.items.findIndex((x) => x.id === itemId) : -1
      const current = idx === -1 ? undefined : f.items[idx]
      const lines = picks.map(({ product: p, license: l }, i) => ({
        ...(i === 0 && current ? current : blankItem()),
        productId: p.id,
        licenseId: l?.id,
        description: pickLabel({ product: p, license: l }),
        unitPrice: round2(convert(l ? l.price : p.price, l ? l.currency : p.currency, f.currency, settings.rates)),
      }))
      const items =
        idx === -1 ? [...f.items, ...lines] : [...f.items.slice(0, idx), ...lines, ...f.items.slice(idx + 1)]
      // Recurring products suggest when the next renewal is due.
      const recurring = picks.map((x) => x.license?.billing ?? x.product.billing).find((b) => b !== 'one-time')
      const renewalDate = f.renewalDate ?? (recurring ? addMonths(f.date, recurring === 'monthly' ? 1 : 12) : undefined)
      return { ...f, items, renewalDate }
    })
    if (itemId) clearError(`item-${itemId}`)
    clearError('items')
  }

  const lineLabel = (i: SaleItem) => {
    const p = db.products.find((x) => x.id === i.productId)
    if (!p) return i.description || 'Unknown product'
    if (!i.licenseId) return p.name
    return `${p.name} · ${p.licenses.find((x) => x.id === i.licenseId)?.name ?? '(removed license)'}`
  }

  const currentPick = (i: SaleItem): PickedItem | undefined => {
    const p = db.products.find((x) => x.id === i.productId)
    return p ? { product: p, license: p.licenses.find((x) => x.id === i.licenseId) } : undefined
  }

  const applyCustomer = (c: Customer) => {
    setForm((f) => {
      const prev = db.customers.find((x) => x.id === f.customerId)
      // A rep that came from the previous company follows the switch; one the user chose stays.
      const repWasAutoFilled = !f.salespersonId || f.salespersonId === prev?.salespersonId
      return {
        ...f,
        customerId: c.id,
        contactId: c.id === f.customerId ? f.contactId : primaryContact(c)?.id,
        salespersonId: repWasAutoFilled ? c.salespersonId : f.salespersonId,
        // New sales follow the customer's usual currency.
        currency: !sale && c.currency && settings.rates[c.currency] ? c.currency : f.currency,
      }
    })
    clearError('customer')
  }

  const applyContact = (p: Contact) => set('contactId', p.id)

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
    const next: Errors = {}
    if (!form.customerId) next.customer = 'Pick a customer.'
    if (!number.trim()) next.number = 'Enter a sale number.'
    else if (isSaleNumberTaken(number, db.sales, form.id)) next.number = 'Another sale already uses this number.'
    if (form.items.length === 0) next.items = 'Add at least one item.'
    for (const i of form.items) {
      const product = db.products.find((p) => p.id === i.productId)
      // A line recorded before the product was split into licenses stays valid as it was.
      const original = sale?.items.find((x) => x.id === i.id)
      const keptAsIs = !!original && original.productId === i.productId && !original.licenseId
      if (!i.productId) next[`item-${i.id}`] = 'Pick a product.'
      else if (product?.sold === 'licenses' && !i.licenseId && !keptAsIs)
        next[`item-${i.id}`] = 'Pick a license of this product.'
      else if (!(i.quantity > 0)) next[`item-${i.id}`] = 'Quantity must be above 0.'
    }
    setErrors(next)
    if (Object.keys(next).length) {
      setTimeout(() => document.querySelector('[role=alert]')?.scrollIntoView({ block: 'center' }), 0)
      return
    }

    const productName = new Map(db.products.map((p) => [p.id, p.name]))
    try {
      upsertSale({
        ...form,
        number: number.trim(),
        items: form.items.map((i) => ({
          ...i,
          description: i.description.trim() || productName.get(i.productId) || '',
        })),
        contactId: customer?.contacts.some((p) => p.id === form.contactId) ? form.contactId : undefined,
        paymentMethod: form.paymentMethod?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
        renewalDate: form.renewalDate || undefined,
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      setErrors({ number: (err as Error).message })
      return
    }
    toast.success(sale ? 'Sale updated' : 'Sale recorded')
    onDone()
  }

  // On a new sale, "reset" returns to the generated number. On an edit it
  // returns to the number the sale already has, never to a new one.
  const resetNumber = sale ? sale.number : generated
  const numberCustom = number !== resetNumber

  return (
    <>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <DialogHeader>
          <DialogTitle>{sale ? `Edit sale ${sale.number}` : 'New sale'}</DialogTitle>
          <DialogDescription>What you sold, to whom, for how much, and when.</DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-5">
          <FormSection title="Customer">
            <div
              className={
                db.salespeople.length > 0
                  ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.4fr)_160px_112px]'
                  : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_160px_112px]'
              }
            >
              <Field label="Company" htmlFor="s-customer" required error={errors.customer}>
                <Combobox
                  id="s-customer"
                  value={form.customerId}
                  onChange={(id) => {
                    const c = db.customers.find((x) => x.id === id)
                    if (c) applyCustomer(c)
                  }}
                  options={customerOptions}
                  placeholder="Pick a company"
                  createLabel="New customer"
                  onCreate={(q) => setCustomerQuery(q)}
                />
              </Field>
              <Field
                label="Contact"
                htmlFor="s-contact"
                hint={customer && contactOptions.length === 0 ? 'No people at this company yet.' : undefined}
              >
                <Combobox
                  id="s-contact"
                  value={form.contactId ?? ''}
                  onChange={(id) => set('contactId', id || undefined)}
                  options={contactOptions}
                  placeholder={customer ? 'Who ordered?' : 'Pick a company first'}
                  disabled={!customer}
                  createLabel="New person"
                  onCreate={(q) => setContactQuery(q)}
                />
              </Field>
              {db.salespeople.length > 0 && (
                <Field label="Sales rep" htmlFor="s-rep">
                  <Combobox
                    id="s-rep"
                    value={form.salespersonId ?? ''}
                    onChange={(id) => set('salespersonId', id || undefined)}
                    options={db.salespeople
                      .filter((p) => p.active || p.id === form.salespersonId)
                      .map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="No rep"
                  />
                </Field>
              )}
              <Field label="Sale date" htmlFor="s-date" required>
                <Input
                  id="s-date"
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => {
                    const next = e.target.value
                    // A renewal keeps its distance from the sale date.
                    setForm((f) => ({
                      ...f,
                      date: next,
                      renewalDate:
                        f.renewalDate && next ? shiftDays(f.renewalDate, daysBetween(f.date, next)) : f.renewalDate,
                    }))
                  }}
                />
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
          </FormSection>

          <FormSection
            title="Items"
            description="Pick products and licenses from your catalog. Each becomes a line you can adjust."
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => setPicker({ mode: 'add' })}>
                <PlusIcon /> Add items
              </Button>
            }
          >
            <div className="overflow-hidden rounded-lg border">
              <div className="bg-muted/40 text-muted-foreground hidden grid-cols-[2fr_2fr_72px_120px_110px_36px] gap-2 border-b px-3 py-2 text-xs font-medium sm:grid">
                <span>Product</span>
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              {form.items.length === 0 && (
                <div className="text-muted-foreground flex flex-col items-center gap-2 px-3 py-8 text-center text-sm">
                  <span>No items yet.</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPicker({ mode: 'add' })}>
                    <PlusIcon /> Add items
                  </Button>
                </div>
              )}
              {form.items.map((item) => {
                const err = errors[`item-${item.id}`]
                return (
                  <div key={item.id} className="border-b px-3 py-2 last:border-b-0">
                    <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[2fr_2fr_72px_120px_110px_36px]">
                      <button
                        type="button"
                        aria-label="Product"
                        aria-invalid={!!err && (!item.productId || !item.licenseId) ? true : undefined}
                        onClick={() => setPicker({ mode: 'replace', itemId: item.id })}
                        className="border-input bg-background hover:border-foreground/25 focus-visible:border-primary focus-visible:ring-primary/20 aria-invalid:border-destructive col-span-2 flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm outline-none focus-visible:ring-[3px] sm:col-span-1"
                      >
                        <span className={cn('truncate', !item.productId && 'text-muted-foreground/70')}>
                          {item.productId ? lineLabel(item) : 'Pick a product'}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs">Change</span>
                      </button>
                      <Input
                        className="col-span-2 sm:col-span-1"
                        placeholder="Description on the sale"
                        aria-label="Description"
                        value={item.description}
                        onChange={(e) => setItem(item.id, { description: e.target.value })}
                      />
                      <NumberInput
                        min="0"
                        step="any"
                        aria-label="Quantity"
                        aria-invalid={!!err && !!item.productId && !(item.quantity > 0)}
                        className="text-right tabular-nums"
                        value={item.quantity}
                        onChange={(quantity) => {
                          setItem(item.id, { quantity })
                          clearError(`item-${item.id}`)
                        }}
                      />
                      <NumberInput
                        min="0"
                        step="0.01"
                        aria-label="Unit price"
                        className="text-right tabular-nums"
                        value={item.unitPrice}
                        onChange={(unitPrice) => setItem(item.id, { unitPrice })}
                      />
                      <div className="text-right text-sm font-medium tabular-nums">
                        {formatMoney(itemTotal(item), currency)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove item"
                        onClick={() => {
                          set(
                            'items',
                            form.items.filter((i) => i.id !== item.id),
                          )
                          clearError(`item-${item.id}`)
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                    {err && (
                      <p className="text-destructive mt-1 text-xs" role="alert">
                        {err}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {errors.items && (
              <p className="text-destructive text-xs" role="alert">
                {errors.items}
              </p>
            )}

            <div className="bg-muted/40 ml-auto grid w-full max-w-sm gap-1.5 rounded-lg p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatMoney(saleSubtotal(form), currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="s-discount" className="text-muted-foreground">
                  Discount
                </label>
                <NumberInput
                  id="s-discount"
                  min="0"
                  step="0.01"
                  className="bg-background h-8 w-28 text-right tabular-nums"
                  value={form.discount}
                  onChange={(discount) => set('discount', discount)}
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
                      <NumberInput
                        id="s-rate"
                        min="0"
                        step="any"
                        className="bg-background h-8 w-28 text-right tabular-nums"
                        value={Number(rateToBase.toPrecision(6))}
                        onChange={setRateToBase}
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
          </FormSection>

          <FormSection title="Payment">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field
                label="Sale number"
                htmlFor="s-number"
                required
                error={errors.number}
                hint={numberCustom ? undefined : `From the pattern ${settings.saleNumberFormat} in Admin.`}
              >
                <div className="flex gap-1">
                  <Input
                    id="s-number"
                    className="font-mono"
                    value={number}
                    onChange={(e) => {
                      setNumberTouched(true)
                      set('number', e.target.value)
                      clearError('number')
                    }}
                  />
                  {numberCustom && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={sale ? 'Use the original number' : 'Use the generated number'}
                      title={`Use ${resetNumber}`}
                      onClick={() => {
                        if (sale) set('number', sale.number)
                        else setNumberTouched(false)
                        clearError('number')
                      }}
                    >
                      <RotateCcwIcon />
                    </Button>
                  )}
                </div>
              </Field>
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
            </div>
          </FormSection>

          <FormSection title="Notes">
            <Textarea
              aria-label="Notes"
              placeholder="License keys, contract reference, anything useful…"
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
            />
          </FormSection>
        </DialogBody>

        <DialogFooter>
          <span className="text-muted-foreground mr-auto text-sm tabular-nums">
            Total {formatMoney(saleTotal(form), currency)}
          </span>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit">{sale ? 'Save changes' : 'Record sale'}</Button>
        </DialogFooter>
      </form>

      {/* Kept outside <form>: React bubbles submit events through portals. */}
      <CustomerDialog
        open={customerQuery !== undefined}
        onOpenChange={(o) => !o && setCustomerQuery(undefined)}
        initialName={customerQuery}
        onSaved={applyCustomer}
      />
      {customer && (
        <ContactDialog
          open={contactQuery !== undefined}
          onOpenChange={(o) => !o && setContactQuery(undefined)}
          customerId={customer.id}
          initialName={contactQuery}
          onSaved={applyContact}
        />
      )}
      <ItemPickerDialog
        open={!!picker}
        onOpenChange={(o) => !o && setPicker(undefined)}
        mode={picker?.mode ?? 'add'}
        current={picker?.mode === 'replace' ? currentPick(form.items.find((i) => i.id === picker.itemId)!) : undefined}
        onPick={(items) => applyPicks(picker?.mode === 'replace' ? picker.itemId : undefined, items)}
      />
    </>
  )
}

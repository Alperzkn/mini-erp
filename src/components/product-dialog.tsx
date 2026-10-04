import { useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, LayersIcon, PackageIcon, PlusIcon, Trash2Icon } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/field'
import { NumberInput } from '@/components/number-input'
import { FormSection } from '@/components/form-section'
import { currencyList, uid } from '@/lib/format'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  BILLINGS,
  PRODUCT_TYPES,
  type Billing,
  type Product,
  type ProductLicense,
  type ProductType,
  type SoldAs,
} from '@/lib/types'

function blank(currency: string): Product {
  return {
    currency,
    id: uid(),
    name: '',
    type: 'license',
    sold: 'item',
    billing: 'one-time',
    price: 0,
    active: true,
    licenses: [],
    createdAt: new Date().toISOString(),
  }
}

function blankLicense(currency: string): ProductLicense {
  return {
    id: uid(),
    name: '',
    price: 0,
    currency,
    billing: 'yearly',
    active: true,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Two steps. Step 1 describes the product and how it is sold. A product sold
 * as licenses has no price of its own, so step 2 collects the licenses.
 */
export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSaved,
  initialName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product
  onSaved?: (p: Product) => void
  /** Prefills the name when created from a search box. */
  initialName?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <ProductForm
            product={product}
            initialName={initialName}
            onDone={(p) => {
              onOpenChange(false)
              if (p) onSaved?.(p)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type Step = 'product' | 'licenses'

const SOLD_OPTIONS = [
  { value: 'item', icon: PackageIcon, title: 'As one item', text: 'One price and one billing cycle.' },
  {
    value: 'licenses',
    icon: LayersIcon,
    title: 'As licenses',
    text: 'Editions, tiers or modules, each priced on its own.',
  },
] as const

function ProductForm({
  product,
  initialName,
  onDone,
}: {
  product?: Product
  initialName?: string
  onDone: (p?: Product) => void
}) {
  const { upsertProduct, db } = useStore()
  const [form, setForm] = useState<Product>(
    () => product ?? { ...blank(db.settings.baseCurrency), name: initialName ?? '' },
  )
  const [step, setStep] = useState<Step>('product')
  const [error, setError] = useState<string>()
  const [licenseError, setLicenseError] = useState<string>()
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setLicense = (id: string, patch: Partial<ProductLicense>) =>
    setForm((f) => ({ ...f, licenses: f.licenses.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
  const byLicense = form.sold === 'licenses'

  const validProduct = () => {
    if (!form.name.trim()) {
      setError('Enter the product name.')
      return false
    }
    return true
  }

  const goToLicenses = () => {
    if (!validProduct()) return
    // Start with one empty row so the step is never blank.
    if (form.licenses.length === 0) set('licenses', [blankLicense(form.currency)])
    setStep('licenses')
  }

  const save = () => {
    if (!validProduct()) return
    if (byLicense && form.licenses.length === 0) {
      setLicenseError('Add at least one license.')
      return
    }
    if (byLicense && form.licenses.some((l) => !l.name.trim())) {
      setLicenseError('Name each license or remove it.')
      return
    }
    const saved: Product = {
      ...form,
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      // A product sold as licenses has no price or cycle of its own.
      price: byLicense ? 0 : Number(form.price) || 0,
      billing: byLicense ? 'one-time' : form.billing,
      licenses: byLicense ? form.licenses.map((l) => ({ ...l, name: l.name.trim() })) : [],
    }
    upsertProduct(saved)
    toast.success(product ? 'Product updated' : 'Product added')
    onDone(saved)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (byLicense && step === 'product') goToLicenses()
    else save()
  }

  const dropsLicenses = product && product.sold === 'licenses' && !byLicense && product.licenses.length > 0

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>
          {step === 'licenses'
            ? `Licenses of ${form.name.trim() || 'this product'}`
            : product
              ? 'Edit product'
              : 'New product'}
        </DialogTitle>
        <DialogDescription>
          {step === 'licenses'
            ? 'The editions, tiers or modules you actually sell. Each has its own price and cycle.'
            : 'Something you sell, either as one item or as a set of licenses.'}
        </DialogDescription>
        {byLicense && (
          <ol className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
            {(['product', 'licenses'] as const).map((s, i) => (
              <li key={s} className="contents">
                {i > 0 && <span aria-hidden className="bg-border h-px w-6" />}
                <span className={cn('flex items-center gap-1.5', step === s && 'text-foreground font-medium')}>
                  <span
                    className={cn(
                      'inline-flex size-5 items-center justify-center rounded-full text-[11px]',
                      step === s ? 'bg-primary text-primary-foreground' : 'bg-muted',
                    )}
                  >
                    {i + 1}
                  </span>
                  {s === 'product' ? 'Product' : 'Licenses'}
                </span>
              </li>
            ))}
          </ol>
        )}
      </DialogHeader>

      {step === 'product' ? (
        <DialogBody className="grid gap-5">
          <FormSection title="Product">
            <div className="grid gap-4">
              <Field label="Name" htmlFor="p-name" required error={error}>
                <Input
                  id="p-name"
                  autoFocus
                  placeholder="Fleet Manager, Onboarding workshop…"
                  value={form.name}
                  onChange={(e) => {
                    set('name', e.target.value)
                    if (error) setError(undefined)
                  }}
                />
              </Field>
              <Field label="Type">
                <Select value={form.type} onValueChange={(v) => set('type', v as ProductType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection title="How is it sold?">
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="How is it sold">
              {SOLD_OPTIONS.map(({ value, icon: Icon, title, text }) => (
                <label
                  key={value}
                  className={cn(
                    'hover:bg-muted/60 flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors',
                    form.sold === value && 'border-primary bg-primary/5 ring-primary/20 ring-[3px]',
                  )}
                >
                  <input
                    type="radio"
                    name="sold-as"
                    className="sr-only"
                    checked={form.sold === value}
                    onChange={() => set('sold', value as SoldAs)}
                  />
                  <Icon
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      form.sold === value ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span>
                    <span className="block font-medium">{title}</span>
                    <span className="text-muted-foreground block text-xs">{text}</span>
                  </span>
                </label>
              ))}
            </div>
            {dropsLicenses && (
              <p className="text-muted-foreground text-xs">
                Switching to one item removes its {product.licenses.length}{' '}
                {product.licenses.length === 1 ? 'license' : 'licenses'}. Past sales keep their lines.
              </p>
            )}
          </FormSection>

          {!byLicense && (
            <FormSection title="Pricing">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Price"
                  htmlFor="p-price"
                  hint="Converted with the current rates when added to a sale in another currency."
                >
                  <div className="flex gap-2">
                    <NumberInput
                      id="p-price"
                      min="0"
                      step="0.01"
                      className="text-right tabular-nums"
                      value={form.price}
                      onChange={(price) => set('price', price)}
                    />
                    <Select value={form.currency} onValueChange={(v) => v && set('currency', v)}>
                      <SelectTrigger className="w-28" aria-label="Currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencyList(db.settings).map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </Field>
                <Field label="Billing" hint="Monthly and yearly suggest a renewal date on each sale.">
                  <Select value={form.billing} onValueChange={(v) => set('billing', v as Billing)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLINGS.map((b) => (
                        <SelectItem key={b.value} value={b.value}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FormSection>
          )}

          <FormSection title="Availability">
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                id="p-active"
                type="checkbox"
                className="accent-primary mt-0.5 size-4"
                checked={form.active}
                onChange={(e) => set('active', e.target.checked)}
              />
              <span>
                <span className="font-medium">Active</span>
                <span className="text-muted-foreground block text-xs">
                  Offered when adding items to a new sale. Inactive products stay on past sales.
                </span>
              </span>
            </label>
          </FormSection>

          <FormSection title="Description">
            <Textarea
              aria-label="Description"
              placeholder="What's included, seat limits, support terms…"
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
            />
          </FormSection>
        </DialogBody>
      ) : (
        <DialogBody className="grid gap-3">
          <div className="text-muted-foreground hidden grid-cols-[1.4fr_1fr_88px_1fr_auto] gap-2 px-1 text-xs font-medium sm:grid">
            <span>Name</span>
            <span>Price</span>
            <span>Currency</span>
            <span>Billing</span>
            <span className="w-9" />
          </div>
          {form.licenses.map((l, i) => (
            <div key={l.id} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_88px_1fr_auto] sm:items-center">
              <Input
                aria-label="License name"
                placeholder="Basic, Pro, 10 seats…"
                autoFocus={i === form.licenses.length - 1 && !l.name}
                value={l.name}
                aria-invalid={!!licenseError && !l.name.trim()}
                onChange={(e) => {
                  setLicense(l.id, { name: e.target.value })
                  if (licenseError) setLicenseError(undefined)
                }}
              />
              <NumberInput
                aria-label="License price"
                min="0"
                step="0.01"
                className="text-right tabular-nums"
                value={l.price}
                onChange={(price) => setLicense(l.id, { price })}
              />
              <Select value={l.currency} onValueChange={(v) => v && setLicense(l.id, { currency: v })}>
                <SelectTrigger className="w-full" aria-label="License currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyList(db.settings).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={l.billing} onValueChange={(v) => setLicense(l.id, { billing: v as Billing })}>
                <SelectTrigger className="w-full" aria-label="License billing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLINGS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${l.name || 'license'}`}
                onClick={() =>
                  set(
                    'licenses',
                    form.licenses.filter((x) => x.id !== l.id),
                  )
                }
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
          {licenseError && (
            <p className="text-destructive text-xs" role="alert">
              {licenseError}
            </p>
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                set('licenses', [...form.licenses, blankLicense(form.currency)])
                if (licenseError) setLicenseError(undefined)
              }}
            >
              <PlusIcon /> Add license
            </Button>
          </div>
        </DialogBody>
      )}

      <DialogFooter>
        {step === 'licenses' && (
          <Button type="button" variant="ghost" className="mr-auto" onClick={() => setStep('product')}>
            <ArrowLeftIcon /> Back
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        {byLicense && step === 'product' ? (
          <Button type="submit">
            Next: add licenses <ArrowRightIcon />
          </Button>
        ) : (
          <Button type="submit">{product ? 'Save changes' : 'Add product'}</Button>
        )}
      </DialogFooter>
    </form>
  )
}

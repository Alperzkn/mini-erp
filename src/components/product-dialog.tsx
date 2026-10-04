import { useState } from 'react'
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
import { BILLINGS, PRODUCT_TYPES, type Billing, type Product, type ProductType } from '@/lib/types'

function blank(currency: string): Product {
  return {
    currency,
    id: uid(),
    name: '',
    type: 'license',
    billing: 'one-time',
    price: 0,
    active: true,
    createdAt: new Date().toISOString(),
  }
}

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
  const [error, setError] = useState<string>()
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Enter the product name.')
      return
    }
    const saved: Product = {
      ...form,
      name: form.name.trim(),
      price: Number(form.price) || 0,
      description: form.description?.trim() || undefined,
    }
    upsertProduct(saved)
    toast.success(product ? 'Product updated' : 'Product added')
    onDone(saved)
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{product ? 'Edit product' : 'New product'}</DialogTitle>
        <DialogDescription>Something you sell. The price is a default you can change on each sale.</DialogDescription>
      </DialogHeader>

      <DialogBody className="grid gap-5">
        <FormSection title="Product">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="p-name" required error={error} className="sm:col-span-2">
              <Input
                id="p-name"
                autoFocus
                placeholder="Pro license, Onboarding workshop…"
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
            <Field label="Billing" hint="Monthly and yearly products suggest a renewal date on each sale.">
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

        <FormSection title="Pricing">
          <Field
            label="Default price"
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
        </FormSection>

        <FormSection title="Availability">
          <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
            <input
              id="p-active"
              type="checkbox"
              className="mt-0.5 size-4 accent-current"
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

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit">{product ? 'Save changes' : 'Add product'}</Button>
      </DialogFooter>
    </form>
  )
}

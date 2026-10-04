import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/field'
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <ProductForm product={product} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ProductForm({ product, onDone }: { product?: Product; onDone: () => void }) {
  const { upsertProduct, db } = useStore()
  const [form, setForm] = useState<Product>(() => product ?? blank(db.settings.baseCurrency))
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    upsertProduct({ ...form, name: form.name.trim(), price: Number(form.price) || 0 })
    toast.success(product ? 'Product updated' : 'Product added')
    onDone()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{product ? 'Edit product' : 'New product'}</DialogTitle>
        <DialogDescription>
          Something you sell. The price is a default you can change on each sale.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name *" htmlFor="p-name" className="sm:col-span-2">
          <Input id="p-name" autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} />
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
        <Field label="Billing">
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
        <Field label="Default price" htmlFor="p-price">
          <div className="flex gap-2">
            <Input
              id="p-price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => set('price', e.target.valueAsNumber || 0)}
            />
            <Select value={form.currency} onValueChange={(v) => v && set('currency', v)}>
              <SelectTrigger className="w-24" aria-label="Currency">
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
        <div className="flex items-end gap-2 pb-2">
          <input
            id="p-active"
            type="checkbox"
            className="size-4 accent-current"
            checked={form.active}
            onChange={(e) => set('active', e.target.checked)}
          />
          <Label htmlFor="p-active">Active (offered in new sales)</Label>
        </div>
        <Field label="Description" htmlFor="p-desc" className="sm:col-span-2">
          <Textarea id="p-desc" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}

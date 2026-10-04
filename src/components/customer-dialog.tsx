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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/field'
import { currencyList, uid } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Customer } from '@/lib/types'

function blank(): Customer {
  return { id: uid(), name: '', contacts: [], createdAt: new Date().toISOString() }
}

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer
  onSaved?: (c: Customer) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Remount the form on each open so it starts from fresh values. */}
        {open && (
          <CustomerForm
            customer={customer}
            onDone={(c) => {
              onOpenChange(false)
              if (c) onSaved?.(c)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CustomerForm({
  customer,
  onDone,
}: {
  customer?: Customer
  onDone: (c?: Customer) => void
}) {
  const { upsertCustomer, db } = useStore()
  const [form, setForm] = useState<Customer>(() => customer ?? blank())
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    const saved = { ...form, name: form.name.trim() }
    upsertCustomer(saved)
    toast.success(customer ? 'Customer updated' : 'Customer added')
    onDone(saved)
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{customer ? 'Edit customer' : 'New customer'}</DialogTitle>
        <DialogDescription>Who you sell to. Only the name is required.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name *" htmlFor="c-name">
          <Input id="c-name" autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="c-email">
          <Input id="c-email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Phone" htmlFor="c-phone">
          <Input id="c-phone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Country" htmlFor="c-country">
          <Input id="c-country" value={form.country ?? ''} onChange={(e) => set('country', e.target.value)} />
        </Field>
        <Field label="Tax / VAT ID" htmlFor="c-tax">
          <Input id="c-tax" value={form.taxId ?? ''} onChange={(e) => set('taxId', e.target.value)} />
        </Field>
        <Field label="Default currency">
          <Select value={form.currency ?? db.settings.baseCurrency} onValueChange={(v) => v && set('currency', v)}>
            <SelectTrigger className="w-full">
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
        </Field>
        <Field label="Notes" htmlFor="c-notes" className="sm:col-span-2">
          <Textarea id="c-notes" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}

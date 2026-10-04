import { useState } from 'react'
import { PlusIcon, Trash2Icon } from 'lucide-react'
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
import { Combobox } from '@/components/combobox'
import { Field } from '@/components/field'
import { FormSection } from '@/components/form-section'
import { currencyList, uid } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Contact, Customer } from '@/lib/types'

function blank(): Customer {
  return {
    id: uid(),
    name: '',
    contacts: [],
    createdAt: new Date().toISOString(),
  }
}

function blankContact(primary: boolean): Contact {
  return { id: uid(), name: '', primary, createdAt: new Date().toISOString() }
}

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
  initialName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer
  onSaved?: (c: Customer) => void
  /** Prefills the company name when created from a search box. */
  initialName?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {/* Remount the form on each open so it starts from fresh values. */}
        {open && (
          <CustomerForm
            customer={customer}
            initialName={initialName}
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
  initialName,
  onDone,
}: {
  customer?: Customer
  initialName?: string
  onDone: (c?: Customer) => void
}) {
  const { upsertCustomer, db } = useStore()
  const [form, setForm] = useState<Customer>(() =>
    customer ? { ...customer, contacts: customer.contacts ?? [] } : { ...blank(), name: initialName ?? '' },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setContact = (id: string, patch: Partial<Contact>) =>
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  const setPrimary = (id: string) =>
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((p) => ({ ...p, primary: p.id === id })),
    }))
  const addContact = () => set('contacts', [...form.contacts, blankContact(form.contacts.length === 0)])
  const removeContact = (id: string) => {
    const rest = form.contacts.filter((p) => p.id !== id)
    if (rest.length && !rest.some((p) => p.primary)) rest[0] = { ...rest[0], primary: true }
    set('contacts', rest)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Enter the company name.'
    // A row with details but no name is probably a mistake, not a blank row.
    for (const p of form.contacts) {
      if (!p.name.trim() && (p.role || p.email || p.phone)) next[`contact-${p.id}`] = 'Enter a name for this person.'
    }
    setErrors(next)
    if (Object.keys(next).length) return

    const clean = (v?: string) => v?.trim() || undefined
    const saved: Customer = {
      ...form,
      name: form.name.trim(),
      email: clean(form.email),
      phone: clean(form.phone),
      website: clean(form.website),
      country: clean(form.country),
      taxId: clean(form.taxId),
      notes: clean(form.notes),
      contacts: form.contacts
        .filter((p) => p.name.trim())
        .map((p) => ({
          ...p,
          name: p.name.trim(),
          role: clean(p.role),
          email: clean(p.email),
          phone: clean(p.phone),
        })),
    }
    upsertCustomer(saved)
    toast.success(customer ? 'Customer updated' : 'Customer added')
    onDone(saved)
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{customer ? 'Edit customer' : 'New customer'}</DialogTitle>
        <DialogDescription>A company you sell to, and the people you deal with there.</DialogDescription>
      </DialogHeader>

      <DialogBody className="grid gap-5">
        <FormSection title="Company">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="c-name" required error={errors.name} className="sm:col-span-2">
              <Input
                id="c-name"
                autoFocus
                placeholder="Acme GmbH"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="c-email" hint="General inbox, if there is one.">
              <Input
                id="c-email"
                type="email"
                placeholder="billing@acme.com"
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="c-phone">
              <Input id="c-phone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Website" htmlFor="c-web">
              <Input
                id="c-web"
                placeholder="acme.com"
                value={form.website ?? ''}
                onChange={(e) => set('website', e.target.value)}
              />
            </Field>
            <Field label="Country" htmlFor="c-country">
              <Input id="c-country" value={form.country ?? ''} onChange={(e) => set('country', e.target.value)} />
            </Field>
            <Field label="Tax / VAT ID" htmlFor="c-tax">
              <Input id="c-tax" value={form.taxId ?? ''} onChange={(e) => set('taxId', e.target.value)} />
            </Field>
            <Field label="Sales rep" htmlFor="c-rep" hint="Pre-filled on new sales to this customer.">
              <Combobox
                id="c-rep"
                value={form.salespersonId ?? ''}
                onChange={(id) => set('salespersonId', id || undefined)}
                options={db.salespeople
                  .filter((p) => p.active || p.id === form.salespersonId)
                  .map((p) => ({ value: p.id, label: p.name }))}
                placeholder={db.salespeople.length ? 'Nobody yet' : 'Add reps on the Sales team page'}
                disabled={db.salespeople.length === 0}
              />
            </Field>
            <Field label="Default currency" hint="Preselected on new sales to this customer.">
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
          </div>
        </FormSection>

        <FormSection
          title="People"
          description="Who you talk to at this company. One of them is the primary contact."
          action={
            <Button type="button" variant="outline" size="sm" onClick={addContact}>
              <PlusIcon /> Add person
            </Button>
          }
        >
          {form.contacts.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
              No people yet. Add the person you usually deal with.
            </p>
          ) : (
            <div className="grid gap-3">
              <div className="text-muted-foreground hidden grid-cols-[1.2fr_1fr_1.3fr_1fr_auto] gap-2 px-1 text-xs font-medium sm:grid">
                <span>Name</span>
                <span>Role</span>
                <span>Email</span>
                <span>Phone</span>
                <span className="w-[5.5rem]">Primary</span>
              </div>
              {form.contacts.map((p, i) => (
                <div key={p.id} className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1.3fr_1fr_auto] sm:items-start">
                  <div>
                    <Input
                      aria-label="Name"
                      placeholder="Full name"
                      aria-invalid={!!errors[`contact-${p.id}`]}
                      autoFocus={i === form.contacts.length - 1 && !p.name}
                      value={p.name}
                      onChange={(e) => setContact(p.id, { name: e.target.value })}
                    />
                    {errors[`contact-${p.id}`] && (
                      <p className="text-destructive mt-1 text-xs" role="alert">
                        {errors[`contact-${p.id}`]}
                      </p>
                    )}
                  </div>
                  <Input
                    aria-label="Role"
                    placeholder="Role"
                    value={p.role ?? ''}
                    onChange={(e) => setContact(p.id, { role: e.target.value })}
                  />
                  <Input
                    aria-label="Email"
                    type="email"
                    placeholder="Email"
                    value={p.email ?? ''}
                    onChange={(e) => setContact(p.id, { email: e.target.value })}
                  />
                  <Input
                    aria-label="Phone"
                    placeholder="Phone"
                    value={p.phone ?? ''}
                    onChange={(e) => setContact(p.id, { phone: e.target.value })}
                  />
                  <div className="flex h-10 w-[5.5rem] items-center justify-between gap-1">
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        name="primary-contact"
                        className="accent-primary size-4"
                        checked={!!p.primary}
                        onChange={() => setPrimary(p.id)}
                        aria-label={`${p.name || 'This person'} is the primary contact`}
                      />
                      <span className="sm:hidden">Primary</span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${p.name || 'person'}`}
                      onClick={() => removeContact(p.id)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FormSection>

        <FormSection title="Notes">
          <Textarea
            aria-label="Notes"
            placeholder="Payment terms, who to CC on invoices, anything useful…"
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </FormSection>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit">{customer ? 'Save changes' : 'Add customer'}</Button>
      </DialogFooter>
    </form>
  )
}

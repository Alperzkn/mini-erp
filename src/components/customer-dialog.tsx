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

      <DialogBody className="grid gap-7">
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
            <ul className="grid gap-3">
              {form.contacts.map((p, i) => (
                <li key={p.id} className="bg-card grid gap-3 rounded-lg border p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Field label="Name" htmlFor={`p-name-${p.id}`} required error={errors[`contact-${p.id}`]}>
                      <Input
                        id={`p-name-${p.id}`}
                        placeholder="Full name"
                        autoFocus={i === form.contacts.length - 1 && !p.name}
                        value={p.name}
                        onChange={(e) => setContact(p.id, { name: e.target.value })}
                      />
                    </Field>
                    <Field label="Role" htmlFor={`p-role-${p.id}`}>
                      <Input
                        id={`p-role-${p.id}`}
                        placeholder="CTO, Procurement…"
                        value={p.role ?? ''}
                        onChange={(e) => setContact(p.id, { role: e.target.value })}
                      />
                    </Field>
                    <div className="flex items-end gap-1 pb-0.5">
                      <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm">
                        <input
                          type="radio"
                          name="primary-contact"
                          className="accent-current"
                          checked={!!p.primary}
                          onChange={() => setPrimary(p.id)}
                        />
                        Primary
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${p.name || 'person'}`}
                        onClick={() => removeContact(p.id)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Email" htmlFor={`p-email-${p.id}`}>
                      <Input
                        id={`p-email-${p.id}`}
                        type="email"
                        value={p.email ?? ''}
                        onChange={(e) => setContact(p.id, { email: e.target.value })}
                      />
                    </Field>
                    <Field label="Phone" htmlFor={`p-phone-${p.id}`}>
                      <Input
                        id={`p-phone-${p.id}`}
                        value={p.phone ?? ''}
                        onChange={(e) => setContact(p.id, { phone: e.target.value })}
                      />
                    </Field>
                  </div>
                </li>
              ))}
            </ul>
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

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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/field'
import { uid } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Contact } from '@/lib/types'

/** Adds or edits one person on a customer. */
export function ContactDialog({
  open,
  onOpenChange,
  customerId,
  contact,
  onSaved,
  initialName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  contact?: Contact
  onSaved?: (p: Contact) => void
  /** Prefills the name when created from a search box. */
  initialName?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <ContactForm
            customerId={customerId}
            contact={contact}
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

function ContactForm({
  customerId,
  contact,
  initialName,
  onDone,
}: {
  customerId: string
  contact?: Contact
  initialName?: string
  onDone: (p?: Contact) => void
}) {
  const { db, upsertContact } = useStore()
  const company = db.customers.find((c) => c.id === customerId)
  const [form, setForm] = useState<Contact>(
    () =>
      contact ?? {
        id: uid(),
        name: initialName ?? '',
        // The first person at a company is its primary contact.
        primary: (company?.contacts.length ?? 0) === 0,
        createdAt: new Date().toISOString(),
      },
  )
  const [error, setError] = useState<string>()
  const set = <K extends keyof Contact>(k: K, v: Contact[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Enter a name.')
      return
    }
    const clean = (v?: string) => v?.trim() || undefined
    const saved: Contact = {
      ...form,
      name: form.name.trim(),
      role: clean(form.role),
      email: clean(form.email),
      phone: clean(form.phone),
      notes: clean(form.notes),
    }
    upsertContact(customerId, saved)
    toast.success(contact ? 'Person updated' : 'Person added')
    onDone(saved)
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{contact ? 'Edit person' : 'New person'}</DialogTitle>
        <DialogDescription>{company ? `Someone at ${company.name}.` : 'A person at this company.'}</DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <Field label="Name" htmlFor="ct-name" required error={error}>
          <Input
            id="ct-name"
            autoFocus
            placeholder="Full name"
            value={form.name}
            onChange={(e) => {
              set('name', e.target.value)
              if (error) setError(undefined)
            }}
          />
        </Field>
        <Field label="Role" htmlFor="ct-role">
          <Input
            id="ct-role"
            placeholder="CTO, Procurement…"
            value={form.role ?? ''}
            onChange={(e) => set('role', e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="ct-email">
            <Input id="ct-email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="ct-phone">
            <Input id="ct-phone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-current"
            checked={!!form.primary}
            onChange={(e) => set('primary', e.target.checked)}
          />
          <Label asChild>
            <span>Primary contact</span>
          </Label>
        </label>
        <Field label="Notes" htmlFor="ct-notes">
          <Textarea id="ct-notes" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit">{contact ? 'Save changes' : 'Add person'}</Button>
      </DialogFooter>
    </form>
  )
}

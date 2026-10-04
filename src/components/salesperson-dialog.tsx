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
import { Field } from '@/components/field'
import { uid } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Salesperson } from '@/lib/types'

/** Adds or edits someone on your own sales team. */
export function SalespersonDialog({
  open,
  onOpenChange,
  salesperson,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  salesperson?: Salesperson
  onSaved?: (p: Salesperson) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <SalespersonForm
            salesperson={salesperson}
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

function SalespersonForm({ salesperson, onDone }: { salesperson?: Salesperson; onDone: (p?: Salesperson) => void }) {
  const { upsertSalesperson } = useStore()
  const [form, setForm] = useState<Salesperson>(
    () => salesperson ?? { id: uid(), name: '', active: true, createdAt: new Date().toISOString() },
  )
  const [error, setError] = useState<string>()
  const set = <K extends keyof Salesperson>(k: K, v: Salesperson[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Enter a name.')
      return
    }
    const saved: Salesperson = {
      ...form,
      name: form.name.trim(),
      email: form.email?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
    }
    upsertSalesperson(saved)
    toast.success(salesperson ? 'Rep updated' : 'Rep added')
    onDone(saved)
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{salesperson ? 'Edit rep' : 'New rep'}</DialogTitle>
        <DialogDescription>Someone on your team who looks after customers and brings in orders.</DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <Field label="Name" htmlFor="sp-name" required error={error}>
          <Input
            id="sp-name"
            autoFocus
            placeholder="Full name"
            value={form.name}
            onChange={(e) => {
              set('name', e.target.value)
              if (error) setError(undefined)
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="sp-email">
            <Input id="sp-email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="sp-phone">
            <Input id="sp-phone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          </Field>
        </div>
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-current"
            checked={form.active}
            onChange={(e) => set('active', e.target.checked)}
          />
          <span>
            <span className="font-medium">Active</span>
            <span className="text-muted-foreground block text-xs">
              Offered when assigning a rep. Inactive reps stay on past sales and customers.
            </span>
          </span>
        </label>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit">{salesperson ? 'Save changes' : 'Add rep'}</Button>
      </DialogFooter>
    </form>
  )
}

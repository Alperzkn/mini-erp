import { useState } from 'react'
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
import { formatMoney } from '@/lib/format'
import { BILLINGS, type Product, type ProductLicense } from '@/lib/types'

const billingLabel = Object.fromEntries(BILLINGS.map((b) => [b.value, b.label]))

/** Tick one or more licenses of a product to add them as sale lines. */
export function LicensePickerDialog({
  open,
  onOpenChange,
  product,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product
  onAdd: (licenses: ProductLicense[]) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && product && (
          <LicenseList
            product={product}
            onDone={(picked) => {
              onOpenChange(false)
              if (picked.length) onAdd(picked)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function LicenseList({ product, onDone }: { product: Product; onDone: (picked: ProductLicense[]) => void }) {
  const licenses = product.licenses.filter((l) => l.active)
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const all = picked.size === licenses.length

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onDone(licenses.filter((l) => picked.has(l.id)))
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <DialogHeader>
        <DialogTitle>{product.name}</DialogTitle>
        <DialogDescription>Tick the licenses to add. Each one becomes its own line on the sale.</DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-1">
        {licenses.length === 0 && (
          <p className="text-muted-foreground py-4 text-center text-sm">This product has no active licenses.</p>
        )}
        {licenses.map((l) => (
          <label
            key={l.id}
            className="hover:bg-muted/60 has-[:checked]:bg-primary/5 has-[:checked]:border-primary/40 flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm transition-colors"
          >
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={picked.has(l.id)}
              onChange={() => toggle(l.id)}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{l.name}</span>
              <span className="text-muted-foreground block text-xs">{billingLabel[l.billing]}</span>
            </span>
            <span className="tabular-nums">{formatMoney(l.price, l.currency)}</span>
          </label>
        ))}
      </DialogBody>
      <DialogFooter>
        {licenses.length > 1 && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto"
            onClick={() => setPicked(all ? new Set() : new Set(licenses.map((l) => l.id)))}
          >
            {all ? 'Clear' : 'Select all'}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => onDone([])}>
          Cancel
        </Button>
        <Button type="submit" disabled={picked.size === 0}>
          {picked.size <= 1 ? 'Add license' : `Add ${picked.size} licenses`}
        </Button>
      </DialogFooter>
    </form>
  )
}

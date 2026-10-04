import { useMemo, useState } from 'react'
import { CheckIcon, LayersIcon, PlusIcon, SearchIcon } from 'lucide-react'
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
import { ProductDialog } from '@/components/product-dialog'
import { formatMoney } from '@/lib/format'
import { pickKey, pickLabel, type PickedItem } from '@/lib/picks'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { BILLINGS, PRODUCT_TYPES, type Product } from '@/lib/types'

const billingLabel = Object.fromEntries(BILLINGS.map((b) => [b.value, b.label]))

/**
 * A two-pane catalog: products on the left (searchable, grouped by type), the
 * chosen product's licenses on the right. In `add` mode several items can be
 * ticked across products; in `replace` mode exactly one is chosen.
 */
export function ItemPickerDialog({
  open,
  onOpenChange,
  mode,
  current,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'replace'
  /** In replace mode, what the line currently holds. */
  current?: PickedItem
  onPick: (items: PickedItem[]) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {open && (
          <Catalog
            mode={mode}
            current={current}
            onDone={(items) => {
              onOpenChange(false)
              if (items.length) onPick(items)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Catalog({
  mode,
  current,
  onDone,
}: {
  mode: 'add' | 'replace'
  current?: PickedItem
  onDone: (items: PickedItem[]) => void
}) {
  const { db } = useStore()
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | undefined>(current?.product.id)
  const [basket, setBasket] = useState<Map<string, PickedItem>>(
    () => new Map(current ? [[pickKey(current), current]] : []),
  )
  const [creating, setCreating] = useState(false)

  // Inactive products stay visible only while they are the current choice.
  const products = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.products
      .filter((p) => p.active || p.id === current?.product.id)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.licenses.some((l) => l.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [db.products, query, current])

  const groups = PRODUCT_TYPES.map((t) => ({ ...t, items: products.filter((p) => p.type === t.value) })).filter(
    (g) => g.items.length > 0,
  )
  const active = db.products.find((p) => p.id === activeId)

  const toggle = (item: PickedItem) => {
    const key = pickKey(item)
    setBasket((b) => {
      const next = mode === 'replace' ? new Map<string, PickedItem>() : new Map(b)
      if (b.has(key) && mode === 'add') next.delete(key)
      else next.set(key, item)
      return next
    })
  }
  const inBasket = (item: PickedItem) => basket.has(pickKey(item))
  const countFor = (p: Product) => [...basket.values()].filter((x) => x.product.id === p.id).length

  const chosen = [...basket.values()]
  const submitLabel =
    mode === 'replace'
      ? 'Use this'
      : chosen.length === 0
        ? 'Add to sale'
        : chosen.length === 1
          ? 'Add 1 item'
          : `Add ${chosen.length} items`

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onDone(chosen)
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <DialogHeader>
          <DialogTitle>{mode === 'replace' ? 'Change item' : 'Add items'}</DialogTitle>
          <DialogDescription>
            {mode === 'replace'
              ? 'Pick the product, then the license, to put on this line.'
              : 'Pick a product, then tick the licenses you sold. You can add from several products at once.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 border-t sm:h-[60vh] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          {/* Left: products */}
          <div className="flex min-h-0 flex-col border-b sm:border-r sm:border-b-0">
            <div className="relative border-b p-3">
              <SearchIcon className="text-muted-foreground absolute top-1/2 left-6 size-4 -translate-y-1/2" />
              <Input
                autoFocus
                className="h-9 pl-9"
                placeholder="Search products and licenses…"
                aria-label="Search products"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {groups.length === 0 && (
                <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                  {db.products.length ? 'No products match.' : 'No products yet.'}
                </p>
              )}
              {groups.map((g) => (
                <div key={g.value} className="mb-2">
                  <div className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium">{g.label}</div>
                  {g.items.map((p) => {
                    const n = countFor(p)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setActiveId(p.id)
                          if (p.sold === 'item' && mode === 'replace') toggle({ product: p })
                        }}
                        className={cn(
                          'hover:bg-muted/70 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                          p.id === activeId && 'bg-primary/10 text-primary font-medium',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        {n > 0 && (
                          <span className="bg-primary text-primary-foreground inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold">
                            {n}
                          </span>
                        )}
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {p.sold === 'licenses' ? (
                            <span className="inline-flex items-center gap-1">
                              <LayersIcon className="size-3" />
                              {p.licenses.filter((l) => l.active).length}
                            </span>
                          ) : (
                            formatMoney(p.price, p.currency)
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => setCreating(true)}
              >
                <PlusIcon /> New product{query.trim() ? ` “${query.trim()}”` : ''}
              </Button>
            </div>
          </div>

          {/* Right: the active product's licenses */}
          <div className="min-h-0 overflow-y-auto p-4">
            {!active ? (
              <div className="text-muted-foreground flex h-full items-center justify-center text-center text-sm">
                Choose a product on the left.
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <div className="font-semibold">{active.name}</div>
                  {active.description && (
                    <p className="text-muted-foreground mt-0.5 text-xs whitespace-pre-wrap">{active.description}</p>
                  )}
                </div>
                {active.sold === 'licenses' ? (
                  <div className="grid gap-1">
                    {active.licenses
                      .filter((l) => l.active || l.id === current?.license?.id)
                      .map((l) => {
                        const item = { product: active, license: l }
                        const on = inBasket(item)
                        return (
                          <label
                            key={l.id}
                            className={cn(
                              'hover:bg-muted/60 has-[:focus-visible]:ring-ring/40 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-[3px]',
                              on ? 'border-primary/40 bg-primary/5' : 'border-transparent',
                            )}
                          >
                            <input
                              type={mode === 'replace' ? 'radio' : 'checkbox'}
                              name="pick"
                              className="accent-primary size-4"
                              checked={on}
                              onChange={() => toggle(item)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium">{l.name}</span>
                              <span className="text-muted-foreground block text-xs">{billingLabel[l.billing]}</span>
                            </span>
                            <span className="tabular-nums">{formatMoney(l.price, l.currency)}</span>
                          </label>
                        )
                      })}
                    {active.licenses.filter((l) => l.active).length === 0 && (
                      <p className="text-muted-foreground text-sm">This product has no active licenses.</p>
                    )}
                  </div>
                ) : (
                  <label
                    className={cn(
                      'hover:bg-muted/60 has-[:focus-visible]:ring-ring/40 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-[3px]',
                      inBasket({ product: active }) ? 'border-primary/40 bg-primary/5' : 'border-transparent',
                    )}
                  >
                    <input
                      type={mode === 'replace' ? 'radio' : 'checkbox'}
                      name="pick"
                      className="accent-primary size-4"
                      checked={inBasket({ product: active })}
                      onChange={() => toggle({ product: active })}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{active.name}</span>
                      <span className="text-muted-foreground block text-xs">{billingLabel[active.billing]}</span>
                    </span>
                    <span className="tabular-nums">{formatMoney(active.price, active.currency)}</span>
                  </label>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          {chosen.length > 0 && (
            <span className="text-muted-foreground mr-auto flex items-center gap-1.5 text-sm">
              <CheckIcon className="text-primary size-4" />
              {mode === 'replace'
                ? pickLabel(chosen[0])
                : `${chosen.length} selected${chosen.length > 1 ? ` from ${new Set(chosen.map((c) => c.product.id)).size} product${new Set(chosen.map((c) => c.product.id)).size > 1 ? 's' : ''}` : ''}`}
            </span>
          )}
          <Button type="button" variant="outline" onClick={() => onDone([])}>
            Cancel
          </Button>
          <Button type="submit" disabled={chosen.length === 0}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </form>

      {/* Nested so a missing product can be created without leaving the picker. */}
      <ProductDialog
        open={creating}
        onOpenChange={setCreating}
        initialName={query.trim() || undefined}
        onSaved={(p) => {
          setQuery('')
          setActiveId(p.id)
          if (p.sold === 'item') toggle({ product: p })
        }}
      />
    </>
  )
}

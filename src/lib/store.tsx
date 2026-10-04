import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { emptyDb, type Customer, type Db, type Product, type Sale, type Settings } from './types'

type SaveState = 'idle' | 'saving' | 'error'

interface Store {
  db: Db
  saveState: SaveState
  upsertCustomer: (c: Customer) => void
  deleteCustomer: (id: string) => void
  upsertProduct: (p: Product) => void
  deleteProduct: (id: string) => void
  /** Creates or updates a sale. New sales get the next sale number. */
  upsertSale: (s: Sale) => void
  deleteSale: (id: string) => void
  updateSettings: (s: Partial<Settings>) => void
  replaceDb: (db: Db) => void
}

const StoreContext = createContext<Store | null>(null)

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id)
  if (idx === -1) return [...list, item]
  const next = list.slice()
  next[idx] = item
  return next
}

/** Fills in any fields missing from older or hand-edited files. */
function normalize(raw: Partial<Db> | null): Db {
  const base = emptyDb()
  if (!raw) return base
  return {
    version: 1,
    settings: { ...base.settings, ...raw.settings },
    customers: raw.customers ?? [],
    products: raw.products ?? [],
    sales: raw.sales ?? [],
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  // Saves are serialized: while one PUT is in flight, later changes wait and
  // only the newest state is sent next.
  const pending = useRef<Db | null>(null)
  const saving = useRef(false)
  const loadedDb = useRef<Db | null>(null)

  const flush = useCallback(async () => {
    if (saving.current) return
    saving.current = true
    while (pending.current) {
      const snapshot = pending.current
      pending.current = null
      setSaveState('saving')
      try {
        const res = await fetch('/api/db', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot),
        })
        if (!res.ok) throw new Error(await res.text())
        setSaveState('idle')
      } catch (err) {
        console.error('Failed to save', err)
        setSaveState('error')
        // Keep the newest state queued so the next change retries it.
        if (!pending.current) pending.current = snapshot
        break
      }
    }
    saving.current = false
  }, [])

  useEffect(() => {
    fetch('/api/db')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: Partial<Db> | null) => {
        const initial = normalize(data)
        loadedDb.current = initial
        setDb(initial)
      })
      .catch((err: Error) => setLoadError(err.message))
  }, [])

  useEffect(() => {
    if (!db || db === loadedDb.current) return
    pending.current = db
    void flush()
  }, [db, flush])

  // Warn before closing the tab while a save hasn't finished.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saving.current || pending.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const update = useCallback((fn: (db: Db) => Db) => {
    setDb((prev) => (prev ? fn(prev) : prev))
  }, [])

  if (loadError) {
    return (
      <div className="text-destructive p-8 text-sm">
        Could not load data from the local server: {loadError}. Is <code>npm run dev</code> running?
      </div>
    )
  }
  if (!db) {
    return <div className="text-muted-foreground p-8 text-sm">Loading…</div>
  }

  const store: Store = {
    db,
    saveState,
    upsertCustomer: (c) => update((d) => ({ ...d, customers: upsert(d.customers, c) })),
    deleteCustomer: (id) =>
      update((d) => ({ ...d, customers: d.customers.filter((c) => c.id !== id) })),
    upsertProduct: (p) => update((d) => ({ ...d, products: upsert(d.products, p) })),
    deleteProduct: (id) =>
      update((d) => ({ ...d, products: d.products.filter((p) => p.id !== id) })),
    upsertSale: (s) =>
      update((d) => {
        const exists = d.sales.some((x) => x.id === s.id)
        if (exists) return { ...d, sales: upsert(d.sales, s) }
        const number = `${d.settings.salePrefix}${String(d.settings.nextSaleNumber).padStart(4, '0')}`
        return {
          ...d,
          settings: { ...d.settings, nextSaleNumber: d.settings.nextSaleNumber + 1 },
          sales: [...d.sales, { ...s, number }],
        }
      }),
    deleteSale: (id) => update((d) => ({ ...d, sales: d.sales.filter((s) => s.id !== id) })),
    updateSettings: (s) => update((d) => ({ ...d, settings: { ...d.settings, ...s } })),
    replaceDb: (next) => update(() => normalize(next)),
  }

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

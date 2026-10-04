import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { today, uid } from './format'
import { normalize } from './migrate'
import { isSaleNumberTaken } from './sale-number'
import type { Contact, Customer, Db, EventType, Product, Sale, SaleEvent, Salesperson, Settings } from './types'

type SaveState = 'idle' | 'saving' | 'error'

interface Store {
  db: Db
  saveState: SaveState
  upsertCustomer: (c: Customer) => void
  deleteCustomer: (id: string) => void
  /** Adds or updates a person on a customer. A primary contact demotes the others. */
  upsertContact: (customerId: string, contact: Contact) => void
  deleteContact: (customerId: string, contactId: string) => void
  upsertProduct: (p: Product) => void
  deleteProduct: (id: string) => void
  upsertSalesperson: (p: Salesperson) => void
  deleteSalesperson: (id: string) => void
  /**
   * Creates or updates a sale. The sale brings its own number; throws when the
   * number is empty or already used by another sale.
   */
  upsertSale: (s: Sale) => void
  deleteSale: (id: string) => void
  addEvent: (saleId: string, e: Omit<SaleEvent, 'id' | 'createdAt'>) => void
  deleteEvent: (saleId: string, eventId: string) => void
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

/** Keeps at most one primary contact, and never leaves `contacts` undefined. */
function withContacts(c: Customer): Customer {
  const contacts = c.contacts ?? []
  const firstPrimary = contacts.find((p) => p.primary)
  return {
    ...c,
    contacts: contacts.map((p) => ({ ...p, primary: p === firstPrimary })),
  }
}

function event(type: EventType, note: string, date = today()): SaleEvent {
  return { id: uid(), date, type, note, createdAt: new Date().toISOString() }
}

/** Adds automatic history entries for what changed between two versions. */
function withAutoEvents(prev: Sale | undefined, next: Sale): Sale {
  const added: SaleEvent[] = []
  if (!prev) {
    added.push(event('system', 'Sale recorded', next.date))
  } else if (prev.status !== next.status) {
    added.push(event('system', `Status changed: ${prev.status} → ${next.status}`))
  }
  return added.length ? { ...next, events: [...next.events, ...added] } : next
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
      .then((data: unknown) => {
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
    upsertCustomer: (c) => update((d) => ({ ...d, customers: upsert(d.customers, withContacts(c)) })),
    deleteCustomer: (id) =>
      update((d) => ({ ...d, customers: d.customers.filter((c) => c.id !== id) })),
    upsertContact: (customerId, contact) =>
      update((d) => ({
        ...d,
        customers: d.customers.map((c) => {
          if (c.id !== customerId) return c
          const contacts = upsert(c.contacts, contact).map((p) =>
            contact.primary && p.id !== contact.id ? { ...p, primary: false } : p,
          )
          return withContacts({ ...c, contacts })
        }),
      })),
    deleteContact: (customerId, contactId) =>
      update((d) => ({
        ...d,
        customers: d.customers.map((c) =>
          c.id === customerId ? { ...c, contacts: c.contacts.filter((p) => p.id !== contactId) } : c,
        ),
      })),
    upsertProduct: (p) => update((d) => ({ ...d, products: upsert(d.products, p) })),
    upsertSalesperson: (p) => update((d) => ({ ...d, salespeople: upsert(d.salespeople, p) })),
    deleteSalesperson: (id) =>
      update((d) => ({ ...d, salespeople: d.salespeople.filter((p) => p.id !== id) })),
    deleteProduct: (id) =>
      update((d) => ({ ...d, products: d.products.filter((p) => p.id !== id) })),
    upsertSale: (s) => {
      // Validate against the current state before queueing the update, so the
      // error reaches the caller instead of surfacing during render.
      const number = s.number.trim()
      if (!number) throw new Error('Sale number is required')
      if (isSaleNumberTaken(number, db.sales, s.id)) throw new Error('Another sale already uses this number')
      update((d) => {
        const prev = d.sales.find((x) => x.id === s.id)
        const next = { ...s, number }
        if (prev) return { ...d, sales: upsert(d.sales, withAutoEvents(prev, next)) }
        let sales = [...d.sales, withAutoEvents(undefined, next)]
        if (s.renewsSaleId) {
          sales = sales.map((x) =>
            x.id === s.renewsSaleId ? { ...x, events: [...x.events, event('system', `Renewed by ${number}`)] } : x,
          )
        }
        return { ...d, sales }
      })
    },
    deleteSale: (id) => update((d) => ({ ...d, sales: d.sales.filter((s) => s.id !== id) })),
    addEvent: (saleId, e) =>
      update((d) => ({
        ...d,
        sales: d.sales.map((x) =>
          x.id === saleId ? { ...x, events: [...x.events, { ...e, id: uid(), createdAt: new Date().toISOString() }] } : x,
        ),
      })),
    deleteEvent: (saleId, eventId) =>
      update((d) => ({
        ...d,
        sales: d.sales.map((x) =>
          x.id === saleId ? { ...x, events: x.events.filter((e) => e.id !== eventId) } : x,
        ),
      })),
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

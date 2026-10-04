# Companies, Sale Numbering and Form Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make customers companies with attached people, generate sale numbers from a date-aware pattern, require a product on every sale line (creatable inline), and rebuild the dialogs/forms with a modern shell.

**Architecture:** Pure logic lives in `src/lib` (`sale-number.ts`, `migrate.ts`) and is unit-tested with Vitest. UI primitives (`dialog.tsx`, `field.tsx`, `form-section.tsx`, `combobox.tsx`) are built once and reused by the three forms. The store stops generating numbers; the form supplies them and the store only enforces uniqueness.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind 4, radix-ui (Dialog, Popover, Select), lucide-react, sonner, Vitest (new).

**Spec:** `docs/superpowers/specs/2026-10-04-companies-numbering-forms-design.md`

## Global Constraints

- Db `version` becomes `3`; `normalize()` must accept v1, v2 and v3 input and be idempotent on v3.
- Default `saleNumberFormat` is exactly `S-{YYYY}-{####}`.
- `SaleItem.productId` is required (`string`) in the type; legacy items may lack it in the file.
- `Settings.salePrefix` and `Settings.nextSaleNumber` are removed everywhere (grep must return nothing in `src/`).
- No new runtime dependency besides what is already installed; Vitest is dev-only.
- `npm run lint` and `npm run build` must pass at the end of every task.
- Keep the neutral palette; only `destructive` colour for errors.

## Review Focus

1. A sale date typed as empty or malformed (`""`, `2026-13-40`) must not crash number generation; fall back to today's date for the tokens. (Pinned in Task 1 tests.)
2. A format with no `#` run (`INV-{YYYY}`) must still produce unique numbers by appending a 4-digit sequence. (Task 1.)
3. Editing a sale and leaving its number unchanged must not be rejected as a duplicate of itself. (Task 2 store test.)
4. A v2 customer with `company` set and no email must migrate without producing `undefined` strings in the contact. (Task 2 migrate test.)
5. Deleting a contact that a sale references must not break the sale view; the sale shows the company only. (Task 6 renders `contact?.name` defensively; manual check.)

---

### Task 1: Vitest and `sale-number.ts`

**Files:**
- Modify: `package.json` (add `vitest` devDependency and `test` script)
- Create: `src/lib/sale-number.ts`
- Test: `src/lib/sale-number.test.ts`

**Interfaces:**
- Produces:
  - `renderParts(format: string, date: string): { prefix: string; suffix: string; width: number }`
  - `nextSaleNumber(format: string, date: string, sales: Pick<Sale,'number'>[]): string`
  - `isSaleNumberTaken(number: string, sales: Pick<Sale,'id'|'number'>[], excludeId?: string): boolean`
  - `validateFormat(format: string): string | null` (null when valid, else a message)

- [ ] **Step 1: Install Vitest and add the script**

```bash
npm i -D vitest
```

In `package.json` scripts add `"test": "vitest run"`. Vitest reads `vite.config.ts`; the json-db plugin is harmless under test.

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/sale-number.test.ts
import { describe, expect, it } from 'vitest'
import { isSaleNumberTaken, nextSaleNumber, renderParts, validateFormat } from './sale-number'

const d = '2026-10-04'

describe('renderParts', () => {
  it('substitutes date tokens and finds the sequence run', () => {
    expect(renderParts('S-{YYYY}{MM}-{###}', d)).toEqual({ prefix: 'S-202610-', suffix: '', width: 3 })
    expect(renderParts('{YY}/{DD}-{##}-X', d)).toEqual({ prefix: '26/04-', suffix: '-X', width: 2 })
  })
  it('appends a 4-wide run when the format has none', () => {
    expect(renderParts('INV-{YYYY}', d)).toEqual({ prefix: 'INV-2026', suffix: '', width: 4 })
  })
  it('falls back to today for a malformed date', () => {
    const y = String(new Date().getFullYear())
    expect(renderParts('{YYYY}-{##}', '2026-13-40').prefix).toBe(`${y}-`)
    expect(renderParts('{YYYY}-{##}', '').prefix).toBe(`${y}-`)
  })
})

describe('nextSaleNumber', () => {
  it('starts at 1 and increments past the highest existing', () => {
    expect(nextSaleNumber('S-{YYYY}-{####}', d, [])).toBe('S-2026-0001')
    const sales = [{ number: 'S-2026-0007' }, { number: 'S-2026-0003' }, { number: 'S-2025-0100' }]
    expect(nextSaleNumber('S-{YYYY}-{####}', d, sales)).toBe('S-2026-0008')
  })
  it('restarts per period and ignores numbers from other prefixes', () => {
    const sales = [{ number: 'S-202609-005' }, { number: 'junk' }]
    expect(nextSaleNumber('S-{YYYY}{MM}-{###}', d, sales)).toBe('S-202610-001')
  })
  it('does not overflow the width', () => {
    expect(nextSaleNumber('{##}', d, [{ number: '99' }])).toBe('100')
  })
  it('treats regex characters in the format literally', () => {
    expect(nextSaleNumber('A.B({YY})-{##}', d, [{ number: 'A.B(26)-04' }])).toBe('A.B(26)-05')
  })
})

describe('isSaleNumberTaken', () => {
  const sales = [{ id: 'a', number: 'S-1' }, { id: 'b', number: 'S-2' }]
  it('ignores the excluded sale and is case-insensitive on surrounding spaces', () => {
    expect(isSaleNumberTaken('S-1', sales)).toBe(true)
    expect(isSaleNumberTaken('S-1', sales, 'a')).toBe(false)
    expect(isSaleNumberTaken(' S-2 ', sales)).toBe(true)
  })
})

describe('validateFormat', () => {
  it('rejects two sequence runs and empty formats', () => {
    expect(validateFormat('S-{YYYY}-{####}')).toBeNull()
    expect(validateFormat('{##}-{##}')).toMatch(/one/i)
    expect(validateFormat('   ')).toMatch(/empty/i)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/sale-number.test.ts`
Expected: FAIL, module `./sale-number` not found.

- [ ] **Step 4: Implement**

```ts
// src/lib/sale-number.ts
// Sale numbers come from a pattern such as "S-{YYYY}-{####}". Date tokens are
// filled from the sale date; the run of # is a zero-padded sequence derived
// from the sales that already share the same rendered prefix/suffix.
import type { Sale } from './types'

export const DEFAULT_SALE_NUMBER_FORMAT = 'S-{YYYY}-{####}'
const RUN = /\{(#{1,8})\}/g

function safeDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    if (d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])) return d
  }
  return new Date()
}

function fillDate(text: string, d: Date): string {
  const yyyy = String(d.getFullYear())
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return text
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yyyy.slice(2))
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
}

export function validateFormat(format: string): string | null {
  if (!format.trim()) return 'The format cannot be empty.'
  const runs = format.match(RUN) ?? []
  if (runs.length > 1) return 'Use only one {####} sequence.'
  return null
}

export function renderParts(format: string, date: string): { prefix: string; suffix: string; width: number } {
  const d = safeDate(date)
  const runs = [...format.matchAll(RUN)]
  if (runs.length === 0) return { prefix: fillDate(format, d), suffix: '', width: 4 }
  const [run] = runs
  const at = run.index ?? 0
  return {
    prefix: fillDate(format.slice(0, at), d),
    suffix: fillDate(format.slice(at + run[0].length), d),
    width: run[1].length,
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function nextSaleNumber(format: string, date: string, sales: Pick<Sale, 'number'>[]): string {
  const { prefix, suffix, width } = renderParts(format, date)
  const re = new RegExp(`^${escapeRe(prefix)}(\\d+)${escapeRe(suffix)}$`)
  let max = 0
  for (const s of sales) {
    const m = re.exec(s.number)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}${String(max + 1).padStart(width, '0')}${suffix}`
}

export function isSaleNumberTaken(number: string, sales: Pick<Sale, 'id' | 'number'>[], excludeId?: string): boolean {
  const n = number.trim()
  return sales.some((s) => s.id !== excludeId && s.number === n)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/sale-number.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/sale-number.ts src/lib/sale-number.test.ts
git commit -m "Add Vitest and pattern-based sale number generation"
```

---

### Task 2: Data model v3, migration and store

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/migrate.ts`
- Modify: `src/lib/store.tsx`
- Test: `src/lib/migrate.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_SALE_NUMBER_FORMAT`, `isSaleNumberTaken` from Task 1.
- Produces:
  - Types `Contact`, `Customer` (with `contacts: Contact[]`), `Sale.contactId?`, `SaleItem.productId: string`, `Settings.saleNumberFormat`, `Db.version: 3`.
  - Store: `upsertSale(s)` now stores `s.number` verbatim and throws `Error('Sale number is already used')` / `Error('Sale number is required')`; new `upsertContact(customerId, contact: Contact)` and `deleteContact(customerId, contactId)`.
  - Helper `primaryContact(c: Customer): Contact | undefined` in `src/lib/format.ts`.

- [ ] **Step 1: Update types**

In `src/lib/types.ts`:

```ts
export interface Contact {
  id: string
  name: string
  role?: string
  email?: string
  phone?: string
  notes?: string
  /** The main person to talk to at this company. */
  primary?: boolean
  createdAt: string
}

/** A customer is a company (or a sole trader) with the people you deal with. */
export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  website?: string
  country?: string
  taxId?: string
  currency?: Currency
  notes?: string
  contacts: Contact[]
  createdAt: string
}
```

`SaleItem.productId: string`. `Sale` gains `contactId?: string` after `customerId`. `Settings` drops `salePrefix`/`nextSaleNumber` and gains `saleNumberFormat: string`. `Db.version: 3`. `emptyDb()` sets `version: 3` and `saleNumberFormat: 'S-{YYYY}-{####}'` (import `DEFAULT_SALE_NUMBER_FORMAT` from `./sale-number`; to avoid an import cycle, `sale-number.ts` must import only the `Sale` type with `import type`).

- [ ] **Step 2: Write failing migration tests**

```ts
// src/lib/migrate.test.ts
import { describe, expect, it } from 'vitest'
import { normalize } from './migrate'

describe('normalize v2 → v3', () => {
  it('turns a person-with-company into a company with a primary contact', () => {
    const db = normalize({
      version: 2,
      settings: { salePrefix: 'INV-', nextSaleNumber: 9 },
      customers: [{ id: 'c1', name: 'Ada', company: 'Acme', email: 'ada@acme.io', createdAt: 'x' }],
    })
    const c = db.customers[0]
    expect(c.name).toBe('Acme')
    expect(c.email).toBeUndefined()
    expect(c.contacts).toHaveLength(1)
    expect(c.contacts[0]).toMatchObject({ name: 'Ada', email: 'ada@acme.io', primary: true })
    expect(c.contacts[0].phone).toBeUndefined()
    expect(db.settings.saleNumberFormat).toBe('INV-{####}')
    expect((db.settings as Record<string, unknown>).nextSaleNumber).toBeUndefined()
  })
  it('turns a person without company into a company named after them', () => {
    const db = normalize({ customers: [{ id: 'c1', name: 'Bob', phone: '1', createdAt: 'x' }] })
    const c = db.customers[0]
    expect(c.name).toBe('Bob')
    expect(c.phone).toBe('1')
    expect(c.contacts[0]).toMatchObject({ name: 'Bob', phone: '1', primary: true })
  })
  it('keeps v3 customers untouched and defaults the format', () => {
    const v3 = { version: 3, customers: [{ id: 'c', name: 'Z', contacts: [{ id: 'p', name: 'P', createdAt: 'x' }], createdAt: 'x' }] }
    const db = normalize(v3)
    expect(db.customers[0].contacts).toEqual(v3.customers[0].contacts)
    expect(db.settings.saleNumberFormat).toBe('S-{YYYY}-{####}')
    expect(db.version).toBe(3)
  })
  it('returns an empty db for null', () => {
    expect(normalize(null).customers).toEqual([])
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/migrate.test.ts` — Expected: FAIL (contacts undefined / format mismatch).

- [ ] **Step 4: Implement migration**

Replace the `customers:` line and settings block in `normalize`:

```ts
function migrateCustomer(c: any): Customer {
  if (Array.isArray(c.contacts)) return c
  const person: Contact = {
    id: `${c.id}-p`,
    name: c.name ?? '',
    primary: true,
    createdAt: c.createdAt ?? new Date().toISOString(),
    ...(c.email ? { email: c.email } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
  }
  const { company, email, phone, ...rest } = c
  if (company) {
    return { ...rest, name: company, contacts: person.name ? [person] : [] }
  }
  return { ...rest, email, phone, contacts: [person] }
}
```

Settings:

```ts
saleNumberFormat:
  s.saleNumberFormat ?? (s.salePrefix ? `${s.salePrefix}{####}` : DEFAULT_SALE_NUMBER_FORMAT),
```

and `customers: (raw.customers ?? []).map(migrateCustomer)`, `version: 3`. Remove `salePrefix`/`nextSaleNumber` lines. Strip `undefined` keys from the returned customer so `toBeUndefined()` assertions and JSON output stay clean (only add keys when truthy, as shown).

- [ ] **Step 5: Run tests** — `npx vitest run` — Expected: PASS.

- [ ] **Step 6: Store changes**

In `src/lib/store.tsx`:
- `upsertSale`: remove number generation. New branch:

```ts
upsertSale: (s) =>
  update((d) => {
    const number = s.number.trim()
    if (!number) throw new Error('Sale number is required')
    if (isSaleNumberTaken(number, d.sales, s.id)) throw new Error('Sale number is already used')
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
  }),
```

Note: `update` wraps a `setDb` functional updater, so a throw inside would surface during render. Instead validate **before** calling `update` using the current `db` from closure: compute `isSaleNumberTaken(number, db.sales, s.id)` outside and throw there. Callers (the sale form) catch and show the message inline.

- Add:

```ts
upsertContact: (customerId, contact) =>
  update((d) => ({
    ...d,
    customers: d.customers.map((c) =>
      c.id === customerId
        ? { ...c, contacts: upsert(c.contacts, contact).map((p) => (contact.primary && p.id !== contact.id ? { ...p, primary: false } : p)) }
        : c,
    ),
  })),
deleteContact: (customerId, contactId) =>
  update((d) => ({
    ...d,
    customers: d.customers.map((c) =>
      c.id === customerId ? { ...c, contacts: c.contacts.filter((p) => p.id !== contactId) } : c,
    ),
  })),
```

- `upsertCustomer` must also enforce a single primary (same map as above) and default `contacts` to `[]`.
- Add to `src/lib/format.ts`: `export function primaryContact(c: Customer) { return c.contacts.find((p) => p.primary) ?? c.contacts[0] }`.

- [ ] **Step 7: Fix compile errors across the app**

Run `npx tsc -b` and fix every error caused by the removed fields: `admin.tsx` (business form, Task 7 replaces it fully; for now just read `saleNumberFormat`), `sale-dialog.tsx` (`blankSale` sets `number: ''` still; `blankItem` needs `productId: ''`), `csv.ts` (`c.company` → `primaryContact(c)?.name`), `customers.tsx`, `customer-detail.tsx`, `sale-detail.tsx`, `customer-dialog.tsx` (`company` field removed; Task 4 rebuilds), `migrate.ts`. Build must pass before commit.

- [ ] **Step 8: Lint, build, commit**

```bash
npm run lint && npm run build && npm test
git add -A && git commit -m "Model customers as companies with contacts; derive sale numbers from format"
```

---

### Task 3: Dialog shell, Field, FormSection, Combobox

**Files:**
- Modify: `src/components/ui/dialog.tsx`
- Modify: `src/components/field.tsx`
- Create: `src/components/form-section.tsx`
- Create: `src/components/combobox.tsx`
- Modify: `src/components/confirm-dialog.tsx`

**Interfaces:**
- Produces:
  - `DialogBody` export; `DialogContent` is `flex flex-col p-0 max-h-[90vh]`.
  - `Field({ label, htmlFor, required, hint, error, className, children })`.
  - `FormSection({ title, description, children, className })`.
  - `Combobox<T>({ value, onChange, options: {value:string,label:string,hint?:string}[], placeholder, emptyText, createLabel?, onCreate?, disabled?, id?, invalid? })`.

- [ ] **Step 1: Dialog shell**

```tsx
// DialogContent className (replace the existing string)
"bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-xl border p-0 shadow-xl duration-200 sm:max-w-lg"
```

Overlay: `bg-black/40 backdrop-blur-[2px]`. Header: `flex flex-col gap-1 border-b px-6 py-5 text-left`. Add:

```tsx
function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-body" className={cn('flex-1 overflow-y-auto px-6 py-5', className)} {...props} />
}
```

Footer: `flex flex-col-reverse gap-2 border-t bg-muted/40 px-6 py-4 sm:flex-row sm:justify-end`. Title: `text-base font-semibold leading-tight`. Close button: `top-5 right-5`. Export `DialogBody`.

Because forms wrap header+body+footer in a `<form>`, the form itself must be the flex column: every form uses `className="flex min-h-0 flex-1 flex-col"`.

- [ ] **Step 2: Field**

```tsx
import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function Field({ label, htmlFor, required, hint, error, className, children }: {
  label: string; htmlFor?: string; required?: boolean; hint?: string; error?: string; className?: string; children: ReactNode
}) {
  return (
    <div className={cn('grid gap-1.5', className)} data-invalid={error ? '' : undefined}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5" aria-hidden>*</span>}
      </Label>
      <div className="[&_[data-slot=input]]:data-[invalid]:border-destructive">{children}</div>
      {error ? (
        <p className="text-destructive text-xs" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  )
}
```

Simpler and reliable: when `error` is set, pass `aria-invalid` to the child via `cloneElement` only if it is a single valid element; otherwise rely on the message. Implement with `isValidElement(children) ? cloneElement(children, { 'aria-invalid': !!error || undefined }) : children`.

- [ ] **Step 3: FormSection**

```tsx
export function FormSection({ title, description, children, className }: {
  title: string; description?: string; children: ReactNode; className?: string
}) {
  return (
    <section className={cn('grid gap-3', className)}>
      <div>
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</h3>
        {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      </div>
      {children}
    </section>
  )
}
```

- [ ] **Step 4: Combobox (Radix Popover + listbox)**

```tsx
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboOption { value: string; label: string; hint?: string }

export function Combobox({ value, onChange, options, placeholder = 'Select…', emptyText = 'No matches', createLabel, onCreate, disabled, id, invalid, className }: {
  value: string; onChange: (v: string) => void; options: ComboOption[]; placeholder?: string; emptyText?: string
  createLabel?: string; onCreate?: (query: string) => void; disabled?: boolean; id?: string; invalid?: boolean; className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = options.find((o) => o.value === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q)) : options
  }, [options, query])
  const rows = onCreate ? filtered.length + 1 : filtered.length
  useEffect(() => { if (open) { setQuery(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 0) } }, [open])
  useEffect(() => { setActive(0) }, [query])

  const choose = (i: number) => {
    if (i < filtered.length) { onChange(filtered[i].value); setOpen(false) }
    else if (onCreate) { setOpen(false); onCreate(query.trim()) }
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, rows - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows) choose(active) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" id={id} disabled={disabled} aria-invalid={invalid || undefined} role="combobox" aria-expanded={open}
          className={cn('border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50', !selected && 'text-muted-foreground', className)}>
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={4} onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-popover text-popover-foreground z-50 w-[var(--radix-popover-trigger-width)] min-w-56 overflow-hidden rounded-md border shadow-md">
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} placeholder="Type to search…"
            role="searchbox" aria-controls={listId} className="placeholder:text-muted-foreground h-9 w-full border-b bg-transparent px-3 text-sm outline-none" />
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1">
            {filtered.map((o, i) => (
              <li key={o.value} role="option" aria-selected={o.value === value} onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}
                className={cn('flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm', i === active && 'bg-accent text-accent-foreground')}>
                <CheckIcon className={cn('size-4 shrink-0', o.value === value ? 'opacity-100' : 'opacity-0')} />
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="text-muted-foreground ml-auto truncate text-xs">{o.hint}</span>}
              </li>
            ))}
            {filtered.length === 0 && !onCreate && <li className="text-muted-foreground px-2 py-4 text-center text-sm">{emptyText}</li>}
            {onCreate && (
              <li role="option" aria-selected={false} onMouseEnter={() => setActive(filtered.length)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(filtered.length)}
                className={cn('mt-1 flex cursor-pointer items-center gap-2 rounded-sm border-t px-2 py-1.5 text-sm', active === filtered.length && 'bg-accent text-accent-foreground')}>
                <PlusIcon className="size-4" /> {createLabel ?? 'Create new'}{query.trim() ? ` “${query.trim()}”` : ''}
              </li>
            )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
```

Check `radix-ui` exports `Popover` (it does in v1.x: `import { Popover } from 'radix-ui'`).

- [ ] **Step 5: ConfirmDialog** — restyle `AlertDialogContent` in `ui/alert-dialog.tsx` with the same `rounded-xl p-0 shadow-xl` shell, header `px-6 py-5 border-b`, footer `px-6 py-4 border-t bg-muted/40`.

- [ ] **Step 6: Lint, build, commit**

```bash
npm run lint && npm run build
git add -A && git commit -m "Add dialog shell, Field, FormSection and Combobox primitives"
```

---

### Task 4: Customer dialog with people, ContactDialog, customer pages

**Files:**
- Rewrite: `src/components/customer-dialog.tsx`
- Create: `src/components/contact-dialog.tsx`
- Modify: `src/pages/customers.tsx`, `src/pages/customer-detail.tsx`

**Interfaces:**
- Consumes: Task 2 store (`upsertCustomer`, `upsertContact`, `deleteContact`, `primaryContact`), Task 3 primitives.
- Produces: `CustomerDialog({ open, onOpenChange, customer?, onSaved?(c) })` unchanged signature; `ContactDialog({ open, onOpenChange, customerId, contact?, onSaved?(p) })`.

- [ ] **Step 1: CustomerDialog**

Form state is a `Customer`. Layout inside `DialogContent className="sm:max-w-2xl"`:

- `DialogHeader`: title "New customer" / "Edit customer", description "A company you sell to, and the people you deal with there."
- `DialogBody` with `grid gap-6`:
  - `FormSection title="Company"`: grid `sm:grid-cols-2`. Fields: Name (required, col-span-2, autoFocus), Email, Phone, Website, Country, Tax / VAT ID, Default currency (Select).
  - `FormSection title="People" description="Who you talk to at this company."`: a list of contact rows. Each row is a `rounded-lg border p-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]` with inputs Name (placeholder "Full name"), Role ("Role, e.g. CTO"), Email, Phone, a "Primary" radio (name `primary`), and a remove icon button. Below: `Button variant="outline" size="sm"` "Add person". The first contact added is marked primary automatically.
  - `FormSection title="Notes"`: Textarea.
- `DialogFooter`: Cancel, Save.
- Validation: name required (inline `error` on the field, no toast). Contacts with an empty name are dropped on save; a contact with a role/email but no name shows an inline error "Name is required" and blocks save.

- [ ] **Step 2: ContactDialog**

```tsx
export function ContactDialog({ open, onOpenChange, customerId, contact, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; customerId: string; contact?: Contact; onSaved?: (p: Contact) => void
}) { /* DialogContent sm:max-w-md; fields Name (required), Role, Email, Phone, Primary checkbox, Notes; on submit upsertContact(customerId, saved); toast; onSaved(saved) */ }
```

Blank contact: `{ id: uid(), name: '', createdAt: new Date().toISOString() }`.

- [ ] **Step 3: Customers list**

Columns: Company, Contact (primary contact name, muted role under it), Email (`c.email || primaryContact(c)?.email`), Country, Sales, Revenue, Last purchase. Search string: `[c.name, c.email, c.country, ...c.contacts.flatMap(p => [p.name, p.email])]`.

- [ ] **Step 4: Customer detail**

- Header description: `primaryContact(customer)?.name` plus role.
- Details card: Email, Phone, Website, Country, Tax / VAT ID, Currency.
- New "People" card between stats and sales: list rows (`name`, `role` badge "Primary" when primary, email link, phone), each with an Edit icon button opening `ContactDialog` with that contact and a Delete icon button (`ConfirmDialog`). Card header action: "Add person".

- [ ] **Step 5: Verify in the browser** — open Customers, create a company with two people, mark one primary, reopen to edit. Screenshot the dialog.

- [ ] **Step 6: Lint, build, commit** — `git commit -m "Customer dialog and pages: company with people"`.

---

### Task 5: ProductDialog with `onSaved` and new shell

**Files:**
- Modify: `src/components/product-dialog.tsx`

**Interfaces:**
- Produces: `ProductDialog({ open, onOpenChange, product?, onSaved?(p: Product), initialName? })`.

- [ ] **Step 1:** Add `onSaved` and `initialName` (prefills the name when created from the sale form's combobox query). Restructure with `DialogBody`, `FormSection "Product"` (Name, Type, Billing), `FormSection "Pricing"` (Default price with currency Select, hint "Converted when added to a sale in another currency."), `FormSection "Availability"` (Active checkbox), Description. Inline name error.
- [ ] **Step 2:** `npm run lint && npm run build`, commit `"Product dialog: new shell and onSaved"`.

---

### Task 6: Sale dialog rebuild

**Files:**
- Rewrite: `src/components/sale-dialog.tsx`
- Modify: `src/lib/format.ts` (`renewalOf` copies `contactId`)

**Interfaces:**
- Consumes: `nextSaleNumber`, `isSaleNumberTaken`, `Combobox`, `ContactDialog`, `ProductDialog`, `CustomerDialog`, store `upsertSale` (throws on duplicate).
- Produces: `SaleDialog({ open, onOpenChange, sale?, initial? })` unchanged.

- [ ] **Step 1: State and number handling**

```ts
const [numberTouched, setNumberTouched] = useState(!!sale)
const generated = useMemo(() => nextSaleNumber(settings.saleNumberFormat, form.date, db.sales), [settings.saleNumberFormat, form.date, db.sales])
useEffect(() => { if (!numberTouched) setForm((f) => ({ ...f, number: generated })) }, [generated, numberTouched])
```

Field "Sale number" (required) with an `Input` (font-mono) and, when `numberTouched && form.number !== generated`, a small ghost button "Reset" that sets `numberTouched=false`. Hint: `Pattern ${settings.saleNumberFormat} · change it in Admin`.

- [ ] **Step 2: Layout**

`DialogContent className="sm:max-w-4xl"`. Body sections:
1. **Customer** (`sm:grid-cols-[2fr_2fr_1fr_1fr]`): Customer `Combobox` (options = companies, hint = primary contact name, `createLabel="New customer"`, `onCreate` opens `CustomerDialog`), Contact `Combobox` (disabled until a customer is picked; options = that company's contacts, `createLabel="New person"`, `onCreate` opens `ContactDialog` with `initialName` = query), Sale date, Currency.
2. **Items**: header row + rows in a bordered, rounded container with dividers. Columns `grid-cols-[2fr_2fr_80px_120px_110px_36px]`: Product `Combobox` (options = active products plus any on this sale, hint = formatted default price, `createLabel="New product"`, `onCreate(q)` sets `creatingForItem = item.id` and opens `ProductDialog` with `initialName=q`), Description Input, Qty, Unit price (right-aligned), line total, remove. Inline error under a row: "Pick a product" / "Quantity must be above 0".
3. **Totals** panel right-aligned in a `bg-muted/40 rounded-lg p-4` block: subtotal, discount input, total, base conversion + rate editor (keep existing logic).
4. **Payment** (`sm:grid-cols-4`): Sale number, Status, Paid on, Payment method, Renewal date.
5. **Notes**.

- [ ] **Step 3: Product creation callback**

```ts
const onProductSaved = (p: Product) => { if (creatingForItem) { pickProduct(creatingForItem, p); setCreatingForItem(undefined) } }
```

`pickProduct(itemId, p: Product)` takes the product object (so a just-created product works before the store re-renders) and sets `productId`, `description`, converted `unitPrice`, and suggests `renewalDate` for recurring billing as today.

- [ ] **Step 4: Validation and submit**

```ts
const errors: Record<string, string> = {}
if (!form.customerId) errors.customer = 'Pick a customer'
if (!form.number.trim()) errors.number = 'Sale number is required'
else if (isSaleNumberTaken(form.number, db.sales, form.id)) errors.number = 'Another sale already uses this number'
for (const i of form.items) { if (!i.productId) errors[`item-${i.id}`] = 'Pick a product'; else if (!(i.quantity > 0)) errors[`item-${i.id}`] = 'Quantity must be above 0' }
if (form.items.length === 0) errors.items = 'Add at least one item'
```

Store errors in state, render them inline, and on failure `document.querySelector('[role=alert]')?.scrollIntoView({ block: 'center' })`. Remove the "Custom item" constant and the item filter that invented `'Item'` descriptions; description defaults to the product name when blank. Wrap `upsertSale` in try/catch and surface the message under the number field.

- [ ] **Step 5: `renewalOf`** in `format.ts` copies `contactId`.

- [ ] **Step 6: Browser verification** — new sale: pick company, add a new person inline, add an item by creating a new product inline, save; confirm number `S-2026-0001`; second sale gets `S-2026-0002`; change date year to 2025 and see `S-2025-0001`; edit number to a duplicate and see the inline error. Screenshot the dialog.

- [ ] **Step 7: Lint, build, test, commit** — `"Sale dialog: pattern numbers, required products, contacts, new layout"`.

---

### Task 7: Admin format setting, CSV, display sites, README

**Files:**
- Modify: `src/pages/admin.tsx` (Business card)
- Modify: `src/lib/csv.ts`
- Modify: `src/components/sales-table.tsx`, `src/pages/sale-detail.tsx`, `src/pages/dashboard.tsx`
- Modify: `README.md`

- [ ] **Step 1: Admin Business card**

Replace prefix field with:

```tsx
<Field label="Sale number format" htmlFor="ad-format" required error={formatError ?? undefined}
  hint={`Next number today: ${nextSaleNumber(business.saleNumberFormat, today(), db.sales)}. Tokens: {YYYY} {YY} {MM} {DD} and one {####} sequence.`}>
  <Input id="ad-format" className="font-mono" value={business.saleNumberFormat} onChange={...} />
</Field>
```

`formatError = validateFormat(business.saleNumberFormat)`; disable Save while non-null. Save writes `saleNumberFormat`.

- [ ] **Step 2: CSV**

- `salesCsv`: column `Company` → `Contact` (`c?.contacts.find(p => p.id === s.contactId)?.name`).
- `customersCsv`: header `Company, Primary contact, Contact email, Email, Phone, Website, Country, Tax ID, Default currency, Sales, Revenue…, Created, Notes`.
- New `contactsCsv(db)`: rows `[company, name, role, email, phone, primary ? 'yes' : 'no', notes]`; add `{ file: 'contacts.csv', label: 'Contacts', build: contactsCsv }` to `CSV_EXPORTS` after customers.

- [ ] **Step 3: Display sites**

- `sales-table.tsx` customer cell: company link plus muted ` · ${contact.name}` when `s.contactId` resolves.
- `sale-detail.tsx` "Customer" fact: company link; a second fact "Contact" with name and role when present.
- `dashboard.tsx` recent sales: company only (no change beyond the removed `company` field).
- Remove any remaining `c.company` usages (grep).

- [ ] **Step 4: README**

Update Features: Customers paragraph (company + people, contact on a sale), Admin paragraph (sale number format with tokens; sequence restarts per period), Sales paragraph (every line is a product; create one inline). Add `contacts.csv` to the data table. Add `npm test`.

- [ ] **Step 5: Lint, build, test, commit** — `"Admin number format, contacts in CSV and views, README"`.

---

### Task 8: End-to-end verification

- [ ] `npm run lint && npm run build && npm test` all green.
- [ ] `grep -rn "salePrefix\|nextSaleNumber\|\.company\b" src server` returns nothing.
- [ ] Browser pass with screenshots: Customers dialog, Sale dialog (light and dark), Admin business card. Check console for errors.
- [ ] Final commit if anything changed.

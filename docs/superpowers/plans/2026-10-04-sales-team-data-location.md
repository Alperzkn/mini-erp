# Sales Team, Renewal Shift, Number Inputs, Data Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renewal dates follow sale-date changes; a sales team linked to companies and sales; number inputs that don't trap a zero; a data folder changeable from Admin.

**Architecture:** Pure date helpers and a pure storage resolver are unit-tested. The server gains a `/api/storage` endpoint backed by a small home-directory config file and resolves the data dir per request. The client gets a `NumberInput`, a `SalespersonDialog`, rep pickers in the two forms, and an Admin card per feature.

**Tech Stack:** React 19, TypeScript, Vite plugin middleware (node:fs, node:os), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-sales-team-data-location-design.md`

## Global Constraints

- Db version stays 3; `normalize()` must default `salespeople` to `[]` and be idempotent.
- Sales rep is optional on sales (user decision).
- Data dir precedence is exactly env → config → `./data`; config file path `~/.config/mini-erp/config.json`.
- No new runtime dependencies. `npm run lint`, `npm run build`, `npm test` green after every task.

## Review Focus

1. Sale date cleared or typed partially (`""`, `2026-1`) must not move or corrupt the renewal date. (Task 1 test: `daysBetween` returns 0 on invalid input.)
2. A config file with a relative or `~`-prefixed path must resolve to an absolute path under the home dir. (Task 4 test.)
3. "Move data here" into a folder that already holds a `db.json` must refuse rather than overwrite. (Task 4 server check; browser-verified in Task 5.)
4. A rep deleted while assigned must be impossible from the UI; a dangling id in a hand-edited file must render as "No rep"/blank, not crash. (Task 3: display sites use `find(...)?.name`.)
5. Number field left empty then blurred must save `0`, and a product price typed as `1.` mid-edit must not snap to `1` while typing. (Task 2 browser check.)

---

### Task 1: Date helpers and renewal shift

**Files:** Modify `src/lib/format.ts`, `src/components/sale-dialog.tsx`; Test `src/lib/format.test.ts` (new).

**Interfaces:** Produces `shiftDays(iso, days): string`, `daysBetween(from, to): number`.

- [ ] Test (RED):
```ts
import { describe, expect, it } from 'vitest'
import { daysBetween, shiftDays } from './format'
describe('daysBetween', () => {
  it('counts whole days across month and year ends', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1)
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
    expect(daysBetween('2026-03-10', '2026-03-01')).toBe(-9)
  })
  it('is 0 for invalid input', () => {
    expect(daysBetween('', '2026-01-01')).toBe(0)
    expect(daysBetween('2026-1', '2026-01-01')).toBe(0)
  })
})
describe('shiftDays', () => {
  it('moves across DST and leap days', () => {
    expect(shiftDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(shiftDays('2026-10-04', -4)).toBe('2026-09-30')
  })
})
```
- [ ] Run `npx vitest run src/lib/format.test.ts` → FAIL (not exported).
- [ ] Implement in `format.ts`:
```ts
const ISO = /^\d{4}-\d{2}-\d{2}$/
export function daysBetween(fromIso: string, toIso: string): number {
  if (!ISO.test(fromIso) || !ISO.test(toIso)) return 0
  const a = Date.UTC(...splitIso(fromIso)); const b = Date.UTC(...splitIso(toIso))
  return Math.round((b - a) / 86_400_000)
}
export function shiftDays(iso: string, days: number): string {
  const d = parseIsoDate(iso); d.setDate(d.getDate() + days); return toIsoDate(d)
}
```
(`splitIso` returns `[y, m-1, d]`.)
- [ ] Sale form: replace the date `onChange` with
```ts
onChange={(e) => {
  const next = e.target.value
  setForm((f) => ({ ...f, date: next, renewalDate: f.renewalDate && next ? shiftDays(f.renewalDate, daysBetween(f.date, next)) : f.renewalDate }))
}}
```
- [ ] Run suite → PASS. Commit `"Renewal date follows sale date changes"`.

### Task 2: NumberInput

**Files:** Create `src/components/number-input.tsx`; modify `sale-dialog.tsx`, `product-dialog.tsx`, `admin.tsx` (RateRow: add `onFocus={(e) => e.target.select()}` only).

**Interfaces:** `NumberInput({ value, onChange, className?, id?, min?, step?, 'aria-label'?, 'aria-invalid'?, disabled? })`.

- [ ] Implement:
```tsx
export function NumberInput({ value, onChange, ...props }) {
  const [draft, setDraft] = useState(() => String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setDraft(String(value)) }, [value, focused])
  return <Input type="number" inputMode="decimal" {...props} value={focused ? draft : String(value)}
    onFocus={(e) => { setFocused(true); setDraft(String(value)); requestAnimationFrame(() => e.target.select()) }}
    onChange={(e) => { setDraft(e.target.value); const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(n) }}
    onBlur={() => { setFocused(false); const n = Number(draft); onChange(Number.isFinite(n) ? n : 0) }} />
}
```
Note: lint forbids setState in effects; instead derive: `const shown = focused ? draft : String(value)` and set the draft on focus only. Drop the effect.
- [ ] Replace the five `valueAsNumber` inputs (qty, unit price, discount, rate, product price). The rate input keeps its `key={currency}` and uses `value={Number(rateToBase.toPrecision(6))}` with `onChange={setRateToBase}`.
- [ ] Browser check on the isolated server: focus unit price showing `0`, type `12` → value `12` (no `012`); clear it, blur → `0`; type `1.` → field shows `1.` while focused.
- [ ] Lint, build, commit `"Number inputs select on focus and allow clearing"`.

### Task 3: Sales team

**Files:** Modify `types.ts`, `migrate.ts` (+test), `store.tsx`, `format.ts` (`renewalOf`), `analytics.ts`, `csv.ts`, `customer-dialog.tsx`, `sale-dialog.tsx`, `sales-table.tsx`, `sale-detail.tsx`, `customer-detail.tsx`, `customers.tsx`, `insights.tsx`, `admin.tsx`; Create `src/components/salesperson-dialog.tsx`.

**Interfaces:** `Salesperson`, `Db.salespeople`, `Customer.salespersonId?`, `Sale.salespersonId?`, store `upsertSalesperson(p)`, `deleteSalesperson(id)`, `Report.bySalesperson`, `salespeopleCsv(db)`.

- [ ] Migration test (RED): `normalize({})` → `salespeople: []`; `normalize({ salespeople: [{id:'r',name:'R',active:true,createdAt:'x'}] })` passes it through. Implement: `salespeople: raw.salespeople ?? []`; `emptyDb()` adds `salespeople: []`.
- [ ] Types + store + `renewalOf` copy. Fix compile errors.
- [ ] `analytics.ts`: `bySalesperson` map keyed by `sale.salespersonId ?? 'none'`, label from `db.salespeople` or `'No rep'`; add to `Report` and the return; `sorted()`.
- [ ] `csv.ts`: sales.csv column "Sales rep" after "Contact"; customers.csv "Sales rep" after "Primary contact"; `salespeopleCsv` with header `Name, Email, Phone, Active, Customers, Sales, Revenue in <base>`; add to `CSV_EXPORTS` as `salespeople.csv` / "Sales team".
- [ ] `SalespersonDialog({ open, onOpenChange, salesperson? })`: fields Name (required), Email, Phone, Active checkbox; same shell as ContactDialog.
- [ ] Admin "Sales team" card after Business: list rows (name, muted email/phone, "Inactive" badge when !active), Edit and Delete icon buttons, "Add rep" button. Delete guard per spec.
- [ ] Customer dialog: `Field label="Sales rep"` with `Combobox` (options: active reps + current), placeholder "Nobody yet". Customer detail Details gets `['Sales rep', rep?.name]`; customers list gets "Rep" column.
- [ ] Sale form: `Field label="Sales rep"` Combobox after Contact; in `applyCustomer`, `salespersonId: f.salespersonId ?? c.salespersonId`. Sales table "Rep" column (hidden when `db.salespeople.length === 0`); sale detail "Sales rep" fact when set.
- [ ] Insights: `<Breakdown title="By sales rep" buckets={report.bySalesperson} … />` after By customer.
- [ ] Browser: Admin add rep "Mina"; assign to Acme in customer dialog; new sale for Acme shows Mina pre-filled; sales table shows Rep. Lint, build, test, commit `"Sales team: reps on companies and sales"`.

### Task 4: Storage resolver and server endpoints

**Files:** Create `server/storage.ts` (+ `server/storage.test.ts`), modify `server/json-db.ts`, `vite.config.ts` test include (Vitest default `**/*.test.ts` already covers `server/`).

**Interfaces:** `resolveDataDir({ env, configDir, home, cwd }): { dataDir, source }`, `readConfig(configDir)`, `writeConfig(configDir, { dataDir })`, `expandPath(p, home)`.

- [ ] Test (RED) in `server/storage.test.ts`:
```ts
it('env wins over config over default', ...)   // env '/e' → {dataDir:'/e', source:'env'}
it('expands ~ and makes relative config paths absolute from home', ...) // '~/erp' → home + '/erp'
it('falls back to <cwd>/data', ...)
```
- [ ] Implement pure functions; `readConfig` returns `{}` on missing/invalid JSON.
- [ ] `json-db.ts`: replace the four module constants with `function dirs() { const { dataDir } = resolveDataDir({ env: process.env.MINI_ERP_DATA_DIR, configDir: CONFIG_DIR, home: os.homedir(), cwd: process.cwd() }); return { DATA_DIR: dataDir, DB_FILE: ..., BACKUP_DIR: ..., CSV_DIR: ... } }` and call it in `readDb`, `backupOncePerDay`, `writeDb`, `writeCsvMirror`.
- [ ] Add handler for `/api/storage` per spec (GET and PUT with `mode`). Copy with `fs.cpSync(src, dst, { recursive: true })` for `backups/` and `csv/` when present; `fs.copyFileSync` for `db.json`.
- [ ] Run `npm test` → PASS. Curl smoke on the isolated server: GET shows default; PUT `{dataDir:'<scratch>/moved', mode:'move'}` → 200 and `db.json` present in the new folder; PUT again same path → 400 "already in use"; PUT into a folder with a db.json with `mode:'move'` → 409. Commit `"Configurable data folder with move/use endpoints"`.

### Task 5: Admin Data location card, store reload, README

**Files:** Create `src/lib/storage.ts`; modify `store.tsx` (`reload()`), `admin.tsx`, `README.md`.

- [ ] `storage.ts`: `getStorage(): Promise<StorageInfo>`, `setStorage(dataDir, mode): Promise<StorageInfo>` throwing `Error(json.error)` on non-2xx.
- [ ] Store: `reload: () => Promise<void>` that fetches `/api/db`, normalizes, sets `loadedDb.current` and state (so no save is triggered).
- [ ] Admin card "Data location" after Backup & restore: loads `getStorage()` on mount; shows path in `font-mono`, note by `source`; input + two buttons; `ConfirmDialog` per action with copy: Move → "Copies your database, backups and CSV files to <path> and switches to it. The current folder is left untouched."; Use → "Switches to <path>. If it has no database yet you start empty; your current data stays where it is."
- [ ] README: "Where your data lives" gains the Admin card and config file; env var paragraph stays.
- [ ] Browser on isolated server: Use `<scratch>/alt` → card shows new path, sales list empty; Move back to original path refuses (db exists) with the error shown; Use original → data back. Lint, build, test, commit `"Admin: change the data folder"`.

### Task 6: Final verification

- [ ] `npm run lint && npm run build && npm test` green; browser sweep for console errors on all pages; screenshots of Admin sales team and data location cards.

# Sales team, renewal follows sale date, number inputs, data location

Date: 2026-10-04. Status: approved in chat.

## Goal

1. Changing a sale's date moves its renewal date by the same number of days.
2. A sales team: people at the user's own company who are responsible for customers and bring in orders. Companies and sales link to a rep.
3. Number inputs no longer leave a `0` that must be deleted by hand.
4. The data folder can be changed from Admin and the choice survives restarts.

## 1. Renewal follows the sale date

`src/lib/format.ts`: `export function shiftDays(iso: string, days: number): string` and
`export function daysBetween(fromIso: string, toIso: string): number` (to − from, in whole days).

Sale form: when the sale date changes from `a` to `b` and `renewalDate` is set, set
`renewalDate = shiftDays(renewalDate, daysBetween(a, b))`. Not applied when the date is
cleared or invalid (`daysBetween` on an invalid date returns 0). The product-pick suggestion
(`addMonths(form.date, …)`) is unchanged.

## 2. Sales team

```ts
export interface Salesperson {
  id: string
  name: string
  email?: string
  phone?: string
  active: boolean
  createdAt: string
}
Db.salespeople: Salesperson[]           // version stays 3; migration defaults to []
Customer.salespersonId?: string         // responsible rep
Sale.salespersonId?: string             // rep who brought the order; optional
```

- Store: `upsertSalesperson(p)`, `deleteSalesperson(id)`. Deleting is blocked in the UI when
  any customer or sale references the rep (toast: "This rep is linked to customers or sales.
  Mark them inactive instead.").
- Admin: a "Sales team" card listing reps (name, email, phone, Active badge) with Add / Edit
  (a `SalespersonDialog` with the dialog shell) and Delete (confirm).
- Customer dialog: "Sales rep" Combobox (active reps plus the currently assigned one) in the
  Company section, with a hint "Pre-filled on new sales to this customer."
- Sale form: "Sales rep" Combobox in the Customer section, after Contact. Picking a company
  on a new sale sets `salespersonId` to the company's rep when the sale has none yet.
- Display: sales table gets a "Rep" column (name, muted); sale detail gets a "Sales rep" fact;
  customer detail shows "Sales rep" in Details; customers list gets a "Rep" column.
- CSV: `sales.csv` gains "Sales rep"; `customers.csv` gains "Sales rep"; new `salespeople.csv`
  (Name, Email, Phone, Active, Customers, Sales, Revenue in base).
- Insights: `Report.bySalesperson` bucketed by `sale.salespersonId` (label "No rep" for
  unassigned); `<Breakdown title="By sales rep">` after "By customer".
- `renewalOf` copies `salespersonId`.

## 3. Number inputs

`src/components/number-input.tsx`: `NumberInput({ value: number, onChange(n: number), min?,
step?, ...inputProps })`. Keeps a local text draft while focused so the field can be empty
mid-edit; on blur commits `Number(draft) || 0` and re-syncs the draft from `value`. On focus
selects the whole content. When the prop `value` changes from outside while not focused,
the draft follows. Replaces every `type="number"` input in the sale, product and admin
rate editors (the Admin rate rows already keep string state; they only gain select-on-focus).

## 4. Data location

Server (`server/json-db.ts`):

- Resolution order for the data directory: `MINI_ERP_DATA_DIR` env var → `dataDir` in
  `~/.config/mini-erp/config.json` → `./data`. The directory is resolved per request, not
  cached at module load, so a change takes effect without a restart.
- `GET /api/storage` → `{ dataDir, source: 'env' | 'config' | 'default', hasDb: boolean,
  defaultDir }`.
- `PUT /api/storage` body `{ dataDir: string, mode: 'move' | 'use' }`:
  - Expands a leading `~`, resolves to an absolute path, rejects relative paths and paths
    equal to the current one (400 with a message).
  - `mode: 'use'`: `mkdir -p`, write config, respond with the new `GET` payload.
  - `mode: 'move'`: refuses (409) if the target already has a `db.json`; otherwise copies
    `db.json`, `backups/`, `csv/` from the current folder (whatever exists), then writes
    config. The source is left in place.
  - When the env var is set, PUT responds 409 "Set by MINI_ERP_DATA_DIR; unset it to change
    the folder here."
- Config writes are atomic (tmp + rename).

Client:

- `src/lib/storage.ts`: `getStorage()`, `setStorage(dataDir, mode)` fetch wrappers with typed
  results.
- Store: `reload()` refetches `/api/db` and replaces the in-memory db.
- Admin "Data location" card: current folder (monospace), source note ("from
  MINI_ERP_DATA_DIR" disables editing), a path input, two buttons "Move data here" and "Use
  this folder", each confirming in a `ConfirmDialog` that says what will happen. On success:
  `reload()`, toast "Now using <path>".
- README: document the Admin card and the config file; keep the env var paragraph.

## Testing

- Vitest: `shiftDays`/`daysBetween` (month and year boundaries, invalid input), migration adds
  `salespeople: []` and passes through existing lists, `NumberInput` behaviour is browser-
  verified (no DOM runner), `resolveDataDir` precedence and `~` expansion in a new
  `server/storage.ts` module that is pure (takes env, config and home as arguments).
- Browser: Admin sales team add/edit; sale form rep pre-fill; number field clears; data
  location "use" then "move" against a scratch folder on an isolated server.

## Out of scope

Commission, per-rep targets, rep login, moving data back automatically.

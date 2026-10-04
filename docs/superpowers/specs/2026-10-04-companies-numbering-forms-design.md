# Companies with contacts, pattern-based sale numbers, product-only items, form redesign

Date: 2026-10-04. Status: approved in chat.

## Goal

Four related changes to the sales tracker:

1. A customer is a company. People (contacts) belong to a company. A sale may record which person ordered.
2. Sale numbers are generated from a date-aware pattern set in Admin, shown pre-filled on the sale form and editable per sale.
3. A sale line must reference a product. Missing products are created from inside the sale form.
4. Dialogs and forms are restructured so they look and behave like a modern product: header, scrollable body, sticky footer, sectioned fields, inline validation, searchable pickers.

## Data model (`src/lib/types.ts`)

```ts
export interface Contact {
  id: string
  name: string
  role?: string
  email?: string
  phone?: string
  notes?: string
  primary?: boolean
  createdAt: string
}

export interface Customer {        // a company
  id: string
  name: string                     // company name
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

export interface Sale {
  ...existing fields...
  contactId?: string               // a Contact.id on the sale's customer
}

export interface SaleItem {
  id: string
  productId: string                // now required
  description: string
  quantity: number
  unitPrice: number
}

export interface Settings {
  businessName: string
  baseCurrency: Currency
  rates: Rates
  ratesUpdatedAt?: string
  saleNumberFormat: string         // default 'S-{YYYY}-{####}'
}

export interface Db { version: 3; ... }
```

`salePrefix` and `nextSaleNumber` are removed from Settings.

## Migration (`src/lib/migrate.ts`, version 2 → 3)

- Customer with `company` set: `name = company`; a contact is created from the old `name`, `email`, `phone` and marked primary. Company `email`/`phone` are left empty.
- Customer without `company`: company `name = name`; a contact with the same name, email and phone is created and marked primary. Company email/phone copy the person's values so nothing visible is lost.
- Customers that already have `contacts` are passed through (idempotent).
- Settings: `saleNumberFormat = s.saleNumberFormat ?? (s.salePrefix ? `${s.salePrefix}{####}` : 'S-{YYYY}-{####}')`. A legacy prefix keeps old numbers looking the same. `nextSaleNumber` is dropped; the sequence is derived from existing sales.
- Sale items keep whatever `productId` they have; a legacy item without one is left as-is in the file. The sale form requires one on the next edit.

## Sale numbers (`src/lib/sale-number.ts`, new)

Pattern tokens: `{YYYY}`, `{YY}`, `{MM}`, `{DD}`, and `{#...#}` (one run of 1–8 `#`, zero-padded sequence). Any other text is literal.

- `renderPrefix(format, date)`: substitutes date tokens; returns `{ prefix, suffix, width }` around the `#` run. If the format has no `#` run, width is 4 and the run is appended at the end.
- `nextSaleNumber(format, date, sales)`: builds the prefix/suffix for `date`, scans `sales` for numbers matching `^prefix(\d+)suffix$`, takes the max captured integer, returns `prefix + pad(max + 1, width) + suffix`. First match → sequence 1. Sequence naturally restarts per year/month/day when the format contains the corresponding date token.
- `isSaleNumberTaken(number, sales, excludeId?)`.

The store no longer assigns numbers. `upsertSale` saves `sale.number` as given and throws if it is empty or taken by a different sale.

Sale form behaviour: `number` is pre-filled with `nextSaleNumber(format, form.date, db.sales)`. Changing the sale date regenerates it while the field is untouched; once the user edits the field it is left alone (a "Reset" affordance restores the generated value). Editing an existing sale shows its stored number, editable with the same uniqueness check.

Admin: "Sale number format" text field with a token legend and a live preview of what the next number would be today. Validation: at most one `#` run.

## Products on sale lines

- The product picker on each line lists active products plus any product already on the sale, and a final "Create new product…" entry that opens `ProductDialog` with `onSaved`. The saved product is applied to the line that opened it (name, converted price, renewal suggestion as today).
- Validation on submit: every line needs a `productId`, a quantity > 0 and a description. Errors appear inline on the line and the submit button scrolls to the first error.
- `ProductDialog` gains an optional `onSaved(product)` prop, mirroring `CustomerDialog`.

## Contacts in the UI

- `CustomerDialog`: sections "Company", "People", "Preferences". The People section is an inline editable list (name, role, email, phone; primary toggle; remove). At least zero contacts allowed.
- Customer detail page: a "People" card listing contacts with role/email/phone; "Add person" opens a small `ContactDialog`; each row has Edit. The header description shows the primary contact.
- Customers list: columns Company, Primary contact, Email (company's or primary contact's), Country, Sales, Revenue, Last purchase. Search covers company and contact names/emails.
- Sale form: "Customer" picker (searchable) and, once a company is chosen, a "Contact" picker filtered to its contacts with "New person" that opens `ContactDialog` for that company and selects the result. Sale detail and sales table show "Company · Person" when a contact is set.
- CSV: customers.csv gains `primary_contact`, `contacts` (count). A new `contacts.csv` export (company, name, role, email, phone). sales.csv replaces the `company` column with `contact`.

## Dialog and form system

- `components/ui/dialog.tsx`: `DialogContent` becomes a flex column with `p-0`, `max-h-[90vh]`, `rounded-xl`, softer shadow. `DialogHeader` gets `px-6 pt-6 pb-4 border-b`. New `DialogBody` (`px-6 py-5 overflow-y-auto flex-1`). `DialogFooter` gets `px-6 py-4 border-t bg-muted/30` and sits below the scroll area so actions stay visible.
- `components/field.tsx`: props `label`, `required`, `hint`, `error`, `htmlFor`. Renders label with a muted "optional"/required marker, the control, then hint or error text (error in destructive colour, sets `aria-invalid` on the child via a wrapper class).
- New `components/form-section.tsx`: title, optional description, children in a grid. Used by all three forms.
- New `components/combobox.tsx`: searchable single-select built on Radix Popover + a text input + a listbox, with an optional "create" row at the bottom (`onCreate(label)`). Used for Customer, Contact and Product pickers. Keyboard: arrows, Enter, Escape.
- Inputs: numeric inputs right-aligned with `tabular-nums`; a `money` input variant shows the currency code as a suffix.
- `ConfirmDialog` adopts the same header/body/footer shell.

Visual direction: keep the existing neutral palette, increase whitespace, use `text-sm` labels in `font-medium`, section titles in `text-xs uppercase tracking-wide text-muted-foreground`. No new colours beyond destructive for errors.

## Testing

- Add Vitest (`npm test`). Tests for `sale-number.ts` (token rendering, sequence derivation, per-period restart, custom width, formats without a run) and `migrate.ts` (both customer shapes, settings prefix carry-over, idempotence on v3 data).
- UI verified manually in the browser with screenshots of: customer dialog with people, sale dialog with inline product creation, admin number format preview.

## Out of scope

Invoice PDFs, taxes, per-contact sales reporting, importing contacts.

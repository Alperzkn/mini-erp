# Mini ERP

A minimalist sales tracker for a small software business. It runs locally, needs no
database server, and keeps all your data in one JSON file.

Track **what** you sold, to **which customer**, at **what price**, **when**, whether it's
**paid**, and when it's **due for renewal**.

Built with React, TypeScript, Vite, Tailwind CSS and [shadcn/ui](https://ui.shadcn.com).

## Quick start

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm start        # opens http://localhost:5173 in your browser
```

`npm run dev` does the same without opening a browser tab. Stop it with `Ctrl+C`.

## Features

- **Dashboard**: revenue this month and this year, amount awaiting payment, a 12-month
  revenue chart, renewals due in the next 60 days (or overdue), and recent sales.
- **Sales**: line items (product or custom), quantity, unit price, discount, status
  (paid / pending / cancelled), paid date, payment method, renewal date, and notes for
  license keys or contract references. Search, filter by status and year, and export to CSV.
- **Renewals**: when you pick a monthly or yearly product, the renewal date is filled in
  for you. "Record renewal" creates the follow-up sale with the same items and the next
  renewal date, and removes the old one from the upcoming list.
- **Customers**: contact details, tax/VAT ID, lifetime revenue, outstanding amount and
  full purchase history.
- **Products** (optional): licenses, subscriptions, services, support. Each has a default
  price and billing cycle (one-time / monthly / yearly).
- Light and dark mode, following your OS setting.

## Where your data lives

| Path | What it is |
|------|------------|
| `data/db.json` | All your data. Human-readable; you can open it in any editor. |
| `data/backups/db-YYYY-MM-DD.json` | Automatic copy of the previous version, taken on the first change each day. |

`data/` is in `.gitignore`, so business data is never committed. Back up the folder
(Dropbox, iCloud, an external drive...) or use **Settings → Download backup**. To store the data
somewhere else, set `MINI_ERP_DATA_DIR`:

```bash
MINI_ERP_DATA_DIR=~/Dropbox/mini-erp npm start
```

The server listens on `localhost` only, so the app isn't reachable from other machines
on your network.

## How it works

There is no separate backend. A small Vite plugin (`server/json-db.ts`) adds two
endpoints to the dev server:

- `GET /api/db` returns the whole database
- `PUT /api/db` replaces it, writing atomically (temp file + rename)

The React app loads everything at startup, keeps it in memory, and saves after every
change. For one person's sales data this stays fast for years of records.

```
src/
  lib/types.ts        data model (Customer, Product, Sale, Settings)
  lib/store.tsx       loading, saving, and all data changes
  lib/format.ts       money/date helpers, totals, renewals
  pages/              Dashboard, Sales, Customers, Products, Settings
  components/         dialogs, tables, and shadcn/ui components (components/ui)
server/json-db.ts     the JSON file API
```

## Why not an existing open-source ERP?

Odoo, ERPNext, Dolibarr and similar tools are full ERPs: inventory, accounting,
HR, manufacturing. They need a database server (PostgreSQL or MariaDB) and take real
effort to set up and maintain. Mini ERP covers only sales tracking.

## Notes and limits

- One currency for everything (set it in Settings). Changing it relabels amounts; it
  doesn't convert them.
- No taxes and no invoice PDFs yet. Put tax details in a sale's notes for now.
- Built for one person on one machine. Don't run two copies against the same data folder.

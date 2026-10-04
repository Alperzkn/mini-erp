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
`npm test` runs the unit tests for sale numbering and data migration.

## Features

- **Dashboard**: upcoming renewals first (next 30 / 60 / 90 days or 12 months, plus
  overdue), then revenue this month and this year, amount awaiting payment, a 12-month
  chart and recent sales.
- **Sales**: line items (each one a product; create the product right from the sale form
  if it doesn't exist yet), quantity, unit price, discount, currency, status (paid / pending /
  cancelled), paid date, payment method, renewal date, the person who ordered, and notes.
  Search, filter by status and year, and export to CSV.
- **Sale numbers**: generated from a pattern you set in Admin, such as `S-{YYYY}-{####}` →
  `S-2026-0001`. Tokens: `{YYYY}`, `{YY}`, `{MM}`, `{DD}` and one `{####}` sequence. The
  sequence restarts whenever the date part changes, so a yearly pattern starts over each
  January. The form fills the next number in for you; change it on any sale if you need to.
- **Order history**: click any sale to open it. Add events to its timeline (note, call,
  email, meeting, invoice sent, payment, license / delivery, support), each with a date.
  Status changes and renewals are logged automatically. A customer's page shows the
  activity across all their orders.
- **Multiple currencies**: USD, EUR and TRY out of the box (add more in Admin). Each sale
  keeps its own currency and the exchange rate of the day it was recorded, which you can
  adjust on the sale. Totals across sales are converted to your reporting currency.
- **Insights**: revenue, collected, outstanding and average sale for any period; revenue
  over time; and breakdowns by product, customer, product type and sale currency. Show
  amounts in any currency, using rates on each sale date or today's rates.
- **Renewals**: when you pick a monthly or yearly product, the renewal date is filled in
  for you. "Renew" creates the follow-up sale with the same items and the next renewal
  date, and removes the old one from the upcoming list.
- **Customers**: a customer is a company (or a sole trader). Each one has the people you
  deal with there, with role, email and phone, and one of them is the primary contact.
  Company details, tax/VAT ID, default currency, lifetime revenue, outstanding amount,
  purchase history and activity.
- **Products**: licenses, subscriptions, services, support. When you create a product you
  choose how it is sold: as one item with its own price and billing cycle, or as **licenses**
  (editions, tiers or modules), each priced on its own, which you add in a second step. On
  a sale, picking a licensed product opens its licenses so you tick the ones sold; each
  becomes its own line. Prices are converted when added to a sale in another currency.
- **Sales team**: your colleagues who look after customers. Assign a rep to each company;
  new sales pick the rep up automatically, and Insights breaks revenue down by rep.
- **Admin**: business name, sale number format, reporting currency, exchange rates,
  CSV exports, backup and restore.
- **Themes**: light, a soft (not pure black) dark, or follow the system. Switch at the
  bottom of the sidebar.

## Where your data lives

| Path | What it is |
|------|------------|
| `data/db.json` | All your data. Human-readable; you can open it in any editor. |
| `data/backups/db-YYYY-MM-DD.json` | Automatic copy of the previous version, taken on the first change each day. |
| `data/csv/*.csv` | Spreadsheet copies (sales, sale items, order events, customers, contacts, sales team, products), rewritten on every save. |

`data/` is in `.gitignore`, so business data is never committed. Back up the folder
(Dropbox, iCloud, an external drive...) or use **Admin → Download backup**.

To keep the data somewhere else, open **Admin → Data location**, type a folder and choose
**Move data here** (copies the database, backups and CSV files there and switches) or **Use this
folder** (switches to whatever is there, or starts empty). The choice is saved in
`~/.config/mini-erp/config.json` and survives restarts. The `MINI_ERP_DATA_DIR` environment
variable still takes precedence when set, which is handy for a one-off run:

```bash
MINI_ERP_DATA_DIR=~/Dropbox/mini-erp npm start
```

The server listens on `localhost` only, so the app isn't reachable from other machines
on your network.

## How it works

There is no separate backend. A small Vite plugin (`server/json-db.ts`) adds a few
endpoints to the dev server:

- `GET /api/db` returns the whole database
- `PUT /api/db` replaces it, writing atomically (temp file + rename), then refreshes
  the CSV copies
- `GET /api/storage` and `PUT /api/storage` read and change the data folder

The React app loads everything at startup, keeps it in memory, and saves after every
change. For one person's sales data this stays fast for years of records.

```
src/
  lib/types.ts        data model (Customer, Contact, Product, Sale, SaleEvent, Settings)
  lib/sale-number.ts  sale number patterns and the next number in a sequence
  lib/store.tsx       loading, saving, and all data changes
  lib/migrate.ts      upgrades older data files to the current shape
  lib/format.ts       money/date/currency helpers, totals, renewals
  lib/analytics.ts    revenue breakdowns for Insights and the dashboard
  lib/csv.ts          CSV exports (used by the browser and the server)
  pages/              Dashboard, Sales, Sale detail, Customers, Sales team, Products, Insights, Admin
  components/         dialogs, tables, and shadcn/ui components (components/ui)
server/json-db.ts     the JSON file API
```

## Why not an existing open-source ERP?

Odoo, ERPNext, Dolibarr and similar tools are full ERPs: inventory, accounting,
HR, manufacturing. They need a database server (PostgreSQL or MariaDB) and take real
effort to set up and maintain. Mini ERP covers only sales tracking.

## Notes and limits

- Exchange rates are entered by hand in Admin; nothing is fetched from the internet.
- No taxes and no invoice PDFs yet. Put tax details in a sale's notes for now.
- Built for one person on one machine. Don't run two copies against the same data folder.

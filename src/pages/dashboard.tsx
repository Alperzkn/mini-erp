import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertCircleIcon, PlusIcon, RefreshCwIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/page-header'
import { SaleDialog } from '@/components/sale-dialog'
import { SalesTable } from '@/components/sales-table'
import { buildReport, monthLabel, monthRange } from '@/lib/analytics'
import {
  addMonths,
  formatCompactMoney,
  formatDate,
  formatMoney,
  openRenewals,
  renewalOf,
  saleTotal,
  today,
} from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Sale } from '@/lib/types'
import { cn } from '@/lib/utils'

const WINDOWS = [30, 60, 90, 365]

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1 py-5">
      <CardHeader className="px-5">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        {hint && <div className="text-muted-foreground mt-1 text-xs">{hint}</div>}
      </CardContent>
    </Card>
  )
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function DueBadge({ days }: { days: number }) {
  if (days < 0)
    return (
      <Badge variant="secondary" className="bg-destructive/10 text-destructive">
        <AlertCircleIcon /> {-days}d overdue
      </Badge>
    )
  if (days === 0) return <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-300">Today</Badge>
  return (
    <Badge
      variant="secondary"
      className={cn(days <= 14 && 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}
    >
      in {days}d
    </Badge>
  )
}

export function DashboardPage() {
  const { db } = useStore()
  const { settings } = db
  const base = settings.baseCurrency
  const money = (n: number) => formatMoney(n, base)
  const [newSaleOpen, setNewSaleOpen] = useState(false)
  const [renewing, setRenewing] = useState<Partial<Sale> | undefined>()
  const [windowDays, setWindowDays] = useState(60)

  const stats = useMemo(() => {
    const now = today()
    const month = now.slice(0, 7)
    const year = now.slice(0, 4)
    const monthReport = buildReport(db.sales.filter((s) => s.date.startsWith(month)), db, 'sale', base)
    const yearReport = buildReport(db.sales.filter((s) => s.date.startsWith(year)), db, 'sale', base)
    const allReport = buildReport(db.sales, db, 'sale', base)
    const pendingCount = db.sales.filter((s) => s.status === 'pending').length
    const from = addMonths(`${month}-01`, -11)
    const lastYear = buildReport(db.sales.filter((s) => s.date >= from), db, 'sale', base)
    const byMonth = new Map(lastYear.byMonth.map((b) => [b.key, b.revenue]))
    const months = monthRange(from, now).map((m) => ({ key: m, label: monthLabel(m), revenue: byMonth.get(m) ?? 0 }))
    return { monthReport, yearReport, outstanding: allReport.outstanding, pendingCount, months }
  }, [db, base])

  const renewals = openRenewals(db.sales).filter((r) => r.days <= windowDays)
  const customers = new Map(db.customers.map((c) => [c.id, c]))
  const recent = [...db.sales]
    .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
    .slice(0, 5)
  const isEmpty = db.sales.length === 0

  return (
    <>
      <PageHeader
        title={settings.businessName}
        description={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={
          <Button onClick={() => setNewSaleOpen(true)}>
            <PlusIcon /> New sale
          </Button>
        }
      />

      {!settings.ratesUpdatedAt && (
        <Card className="mb-6 border-amber-500/40 bg-amber-500/5 py-4">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 text-sm">
            <span>Exchange rates are placeholders. Enter today's rates so totals in {base} are right.</span>
            <Button size="sm" variant="outline" asChild>
              <Link to="/admin">Set exchange rates</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {isEmpty && (
        <Card className="mb-6 border-dashed">
          <CardContent className="text-sm">
            <p className="font-medium">Welcome! Getting started takes a minute:</p>
            <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5">
              <li>
                Set your business name and exchange rates in{' '}
                <Link className="underline" to="/admin">
                  Admin
                </Link>
                .
              </li>
              <li>
                Optionally add what you sell in{' '}
                <Link className="underline" to="/products">
                  Products
                </Link>
                .
              </li>
              <li>Record a sale. You can add the customer right from the sale form.</li>
            </ol>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6 pb-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCwIcon className="text-muted-foreground size-4" /> Upcoming renewals
          </CardTitle>
          <CardDescription>
            {renewals.length
              ? `${plural(renewals.length, 'renewal')} due, including overdue`
              : 'Subscriptions and licenses with a renewal date show up here'}
          </CardDescription>
          <CardAction>
            <Select value={String(windowDays)} onValueChange={(v) => v && setWindowDays(Number(v))}>
              <SelectTrigger size="sm" className="w-36" aria-label="Show renewals due within">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOWS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    Next {d === 365 ? '12 months' : `${d} days`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent className="px-2">
          {renewals.length === 0 ? (
            <p className="text-muted-foreground px-4 pb-4 text-sm">Nothing due in this window.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Due</TableHead>
                  <TableHead>Renewal date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead className="text-right">Last amount</TableHead>
                  <TableHead>From sale</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {renewals.map(({ sale, days }) => {
                  const c = customers.get(sale.customerId)
                  return (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <DueBadge days={days} />
                      </TableCell>
                      <TableCell>{formatDate(sale.renewalDate)}</TableCell>
                      <TableCell className="font-medium">
                        {c ? (
                          <Link to={`/customers/${c.id}`} className="hover:underline">
                            {c.name}
                          </Link>
                        ) : (
                          'Unknown'
                        )}
                      </TableCell>
                      <TableCell className="max-w-64 truncate">
                        {sale.items.map((i) => i.description).join(', ')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(saleTotal(sale), sale.currency)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <Link to={`/sales/${sale.id}`} className="text-muted-foreground hover:underline">
                          {sale.number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setRenewing(renewalOf(sale))}>
                          Renew
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="This month" value={money(stats.monthReport.revenue)} hint={plural(stats.monthReport.count, 'sale')} />
        <Stat label="This year" value={money(stats.yearReport.revenue)} hint={plural(stats.yearReport.count, 'sale')} />
        <Stat label="Awaiting payment" value={money(stats.outstanding)} hint={plural(stats.pendingCount, 'pending sale')} />
        <Stat label="Customers" value={String(db.customers.length)} hint={plural(db.products.length, 'product')} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue, last 12 months</CardTitle>
            <CardDescription>In {base}</CardDescription>
            <CardAction>
              <Button variant="link" size="sm" asChild>
                <Link to="/insights">Insights</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="h-56 px-2 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.months} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={4}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  tickFormatter={(v: number) => formatCompactMoney(v, base)}
                />
                <Tooltip
                  cursor={{ fill: 'var(--muted)' }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
                        <div className="text-muted-foreground">{label}</div>
                        <div className="font-medium tabular-nums">{money(Number(payload[0].value))}</div>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="revenue" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="pb-2 lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent sales</CardTitle>
            <CardAction>
              <Button variant="link" size="sm" asChild>
                <Link to="/sales">View all</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-2">
            <SalesTable sales={recent} />
          </CardContent>
        </Card>
      </div>

      <SaleDialog open={newSaleOpen} onOpenChange={setNewSaleOpen} />
      <SaleDialog open={!!renewing} onOpenChange={(o) => !o && setRenewing(undefined)} initial={renewing} />
    </>
  )
}


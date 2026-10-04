import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertCircleIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import { SaleDialog } from '@/components/sale-dialog'
import { SalesTable } from '@/components/sales-table'
import { countsAsRevenue, formatDate, formatMoney, openRenewals, renewalOf, saleTotal, today } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Sale } from '@/lib/types'
import { cn } from '@/lib/utils'

const RENEWAL_WINDOW_DAYS = 60

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

export function DashboardPage() {
  const { db } = useStore()
  const currency = db.settings.currency
  const money = (n: number) => formatMoney(n, currency)
  const [newSaleOpen, setNewSaleOpen] = useState(false)
  const [renewing, setRenewing] = useState<Partial<Sale> | undefined>()

  const stats = useMemo(() => {
    const now = today()
    const month = now.slice(0, 7)
    const year = now.slice(0, 4)
    const active = db.sales.filter(countsAsRevenue)
    const sum = (list: Sale[]) => list.reduce((s, x) => s + saleTotal(x), 0)
    const thisMonth = active.filter((s) => s.date.startsWith(month))
    const thisYear = active.filter((s) => s.date.startsWith(year))
    const pending = active.filter((s) => s.status === 'pending')

    // Last 12 months, oldest first.
    const months: { key: string; label: string; revenue: number }[] = []
    const d = new Date()
    d.setDate(1)
    for (let i = 11; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
      months.push({
        key,
        label: m.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        revenue: 0,
      })
    }
    const byKey = new Map(months.map((m) => [m.key, m]))
    for (const s of active) {
      const m = byKey.get(s.date.slice(0, 7))
      if (m) m.revenue += saleTotal(s)
    }

    return {
      monthRevenue: sum(thisMonth),
      monthCount: thisMonth.length,
      yearRevenue: sum(thisYear),
      yearCount: thisYear.length,
      pendingAmount: sum(pending),
      pendingCount: pending.length,
      months,
    }
  }, [db.sales])

  const renewals = openRenewals(db.sales).filter((r) => r.days <= RENEWAL_WINDOW_DAYS)
  const customers = new Map(db.customers.map((c) => [c.id, c]))
  const recent = [...db.sales].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)).slice(0, 5)
  const isEmpty = db.sales.length === 0

  return (
    <>
      <PageHeader
        title={db.settings.businessName}
        description="Overview of your sales."
        actions={
          <Button onClick={() => setNewSaleOpen(true)}>
            <PlusIcon /> New sale
          </Button>
        }
      />

      {isEmpty && (
        <Card className="mb-6 border-dashed">
          <CardContent className="text-sm">
            <p className="font-medium">Welcome! Getting started takes a minute:</p>
            <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5">
              <li>
                Set your business name and currency in <Link className="underline" to="/settings">Settings</Link>.
              </li>
              <li>
                Optionally add what you sell in <Link className="underline" to="/products">Products</Link>.
              </li>
              <li>Record a sale. You can add the customer right from the sale form.</li>
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="This month" value={money(stats.monthRevenue)} hint={`${stats.monthCount} sale${stats.monthCount === 1 ? '' : 's'}`} />
        <Stat label="This year" value={money(stats.yearRevenue)} hint={`${stats.yearCount} sale${stats.yearCount === 1 ? '' : 's'}`} />
        <Stat
          label="Awaiting payment"
          value={money(stats.pendingAmount)}
          hint={`${stats.pendingCount} pending sale${stats.pendingCount === 1 ? '' : 's'}`}
        />
        <Stat label="Customers" value={String(db.customers.length)} hint={`${db.products.length} product${db.products.length === 1 ? '' : 's'}`} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue, last 12 months</CardTitle>
            <CardDescription>Paid and pending sales, by sale date</CardDescription>
          </CardHeader>
          <CardContent className="h-64 px-2 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.months} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  tickFormatter={(v: number) =>
                    new Intl.NumberFormat(undefined, { notation: 'compact', style: 'currency', currency }).format(v)
                  }
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
                <Bar dataKey="revenue" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming renewals</CardTitle>
            <CardDescription>Due within {RENEWAL_WINDOW_DAYS} days, or overdue</CardDescription>
          </CardHeader>
          <CardContent>
            {renewals.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing due soon.</p>
            ) : (
              <ul className="divide-y">
                {renewals.map(({ sale, days }) => (
                  <li key={sale.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {customers.get(sale.customerId)?.name ?? 'Unknown'}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {sale.items.map((i) => i.description).join(', ')} · {money(saleTotal(sale))}
                      </div>
                      <div
                        className={cn(
                          'mt-0.5 flex items-center gap-1 text-xs',
                          days < 0 ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {days < 0 && <AlertCircleIcon className="size-3" />}
                        {formatDate(sale.renewalDate)} ·{' '}
                        {days < 0 ? `${-days}d overdue` : days === 0 ? 'today' : `in ${days}d`}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setRenewing(renewalOf(sale))}>
                      Renew
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="pb-2">
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

      <SaleDialog open={newSaleOpen} onOpenChange={setNewSaleOpen} />
      <SaleDialog open={!!renewing} onOpenChange={(o) => !o && setRenewing(undefined)} initial={renewing} />
    </>
  )
}

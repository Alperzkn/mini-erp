import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { buildReport, monthLabel, monthRange, type Bucket } from '@/lib/analytics'
import { addMonths, currencyList, formatCompactMoney, formatMoney, today, type RateMode } from '@/lib/format'
import { useStore } from '@/lib/store'

type Period = 'this-month' | 'last-3' | 'last-12' | 'this-year' | 'last-year' | 'all' | 'custom'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-3', label: 'Last 3 months' },
  { value: 'last-12', label: 'Last 12 months' },
  { value: 'this-year', label: 'This year' },
  { value: 'last-year', label: 'Last year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom…' },
]

function periodRange(p: Period, earliest: string): [string, string] {
  const t = today()
  const y = Number(t.slice(0, 4))
  const monthStart = `${t.slice(0, 7)}-01`
  switch (p) {
    // Whole calendar periods, so sales already booked for later this month/year count.
    case 'this-month':
      return [monthStart, `${t.slice(0, 7)}-31`]
    case 'last-3':
      return [addMonths(monthStart, -2), t]
    case 'last-12':
      return [addMonths(monthStart, -11), t]
    case 'this-year':
      return [`${y}-01-01`, `${y}-12-31`]
    case 'last-year':
      return [`${y - 1}-01-01`, `${y - 1}-12-31`]
    default:
      return [earliest < t ? earliest : t, t]
  }
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
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

/** A ranked list with a thin bar per row: the bar shows share, text shows the value. */
function Breakdown({
  title,
  description,
  buckets,
  currency,
  countLabel,
  limit = 8,
}: {
  title: string
  description?: string
  buckets: Bucket[]
  currency: string
  countLabel?: (n: number) => string
  limit?: number
}) {
  const [showAll, setShowAll] = useState(false)
  const total = buckets.reduce((s, b) => s + b.revenue, 0)
  const max = Math.max(...buckets.map((b) => b.revenue), 0)
  const rows = showAll ? buckets : buckets.slice(0, limit)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {buckets.length === 0 ? (
          <p className="text-muted-foreground text-sm">No sales in this period.</p>
        ) : (
          <ul className="grid gap-3">
            {rows.map((b) => {
              const share = total > 0 ? b.revenue / total : 0
              return (
                <li key={b.key} className="grid gap-1" title={`${b.label}: ${formatMoney(b.revenue, currency)}`}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{b.label}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-medium">{formatMoney(b.revenue, currency)}</span>
                      <span className="text-muted-foreground ml-2 inline-block w-10 text-right text-xs">
                        {Math.round(share * 100)}%
                      </span>
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${max > 0 ? (b.revenue / max) * 100 : 0}%`, background: 'var(--chart-2)' }}
                    />
                  </div>
                  {countLabel && <div className="text-muted-foreground text-xs">{countLabel(b.count)}</div>}
                </li>
              )
            })}
          </ul>
        )}
        {buckets.length > limit && (
          <Button variant="link" size="sm" className="mt-2 px-0" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show less' : `Show all ${buckets.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function InsightsPage() {
  const { db } = useStore()
  const { settings } = db
  const [period, setPeriod] = useState<Period>('this-year')
  const [currency, setCurrency] = useState(settings.baseCurrency)
  const [mode, setMode] = useState<RateMode>('sale')
  const earliest = useMemo(() => db.sales.reduce((min, s) => (s.date < min ? s.date : min), today()), [db.sales])
  const [custom, setCustom] = useState<[string, string]>(() => periodRange('this-year', earliest))
  const [from, to] = period === 'custom' ? custom : periodRange(period, earliest)

  const report = useMemo(() => {
    const sales = db.sales.filter((s) => s.date >= from && s.date <= to)
    return buildReport(sales, db, mode, currency)
  }, [db, from, to, mode, currency])

  // Monthly bars; long ranges switch to yearly so the chart stays readable.
  const series = useMemo(() => {
    const months = monthRange(from, to)
    const byMonth = new Map(report.byMonth.map((b) => [b.key, b.revenue]))
    if (months.length <= 36) {
      return months.map((m) => ({ key: m, label: monthLabel(m), revenue: byMonth.get(m) ?? 0 }))
    }
    const byYear = new Map<string, number>()
    for (const m of months) byYear.set(m.slice(0, 4), (byYear.get(m.slice(0, 4)) ?? 0) + (byMonth.get(m) ?? 0))
    return [...byYear].map(([y, revenue]) => ({ key: y, label: y, revenue }))
  }, [from, to, report.byMonth])

  const money = (n: number) => formatMoney(n, currency)
  const units = (n: number) => `${n} unit${n === 1 ? '' : 's'} sold`
  const salesCount = (n: number) => `${n} sale${n === 1 ? '' : 's'}`

  return (
    <>
      <PageHeader title="Insights" description="Where your revenue comes from. Cancelled sales are left out." />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Select value={period} onValueChange={(v) => v && setPeriod(v as Period)}>
          <SelectTrigger className="w-40" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="From"
              className="w-40"
              value={custom[0]}
              onChange={(e) => e.target.value && setCustom([e.target.value, custom[1]])}
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              aria-label="To"
              className="w-40"
              value={custom[1]}
              onChange={(e) => e.target.value && setCustom([custom[0], e.target.value])}
            />
          </div>
        )}
        <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
          <SelectTrigger className="w-28" aria-label="Show amounts in">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencyList(settings).map((c) => (
              <SelectItem key={c} value={c}>
                in {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mode} onValueChange={(v) => v && setMode(v as RateMode)}>
          <SelectTrigger className="w-52" aria-label="Exchange rates">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sale">Rates on each sale date</SelectItem>
            <SelectItem value="current">Today's rates (Admin)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenue" value={money(report.revenue)} hint={salesCount(report.count)} />
        <Kpi label="Collected" value={money(report.paid)} hint="Paid sales" />
        <Kpi label="Outstanding" value={money(report.outstanding)} hint="Pending sales" />
        <Kpi label="Average sale" value={money(report.average)} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Revenue over time</CardTitle>
          <CardDescription>
            {series.length && series[0].key.length === 4 ? 'By year' : 'By month'}, in {currency}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64 px-2 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={8}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                tickFormatter={(v: number) => formatCompactMoney(v, currency)}
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Breakdown
          title="By product"
          description="Discounts are spread over a sale's items"
          buckets={report.byProduct}
          currency={currency}
          countLabel={units}
        />
        <Breakdown title="By customer" buckets={report.byCustomer} currency={currency} countLabel={salesCount} />
        {db.salespeople.length > 0 && (
          <Breakdown title="By sales rep" buckets={report.bySalesperson} currency={currency} countLabel={salesCount} />
        )}
        {report.byLicense.length > 0 && (
          <Breakdown title="By license" buckets={report.byLicense} currency={currency} countLabel={(n) => `${n} sold`} />
        )}
        <Breakdown title="By product type" buckets={report.byType} currency={currency} />
        <Card>
          <CardHeader>
            <CardTitle>By sale currency</CardTitle>
            <CardDescription>What you actually invoiced, not converted</CardDescription>
          </CardHeader>
          <CardContent>
            {report.byCurrency.length === 0 ? (
              <p className="text-muted-foreground text-sm">No sales in this period.</p>
            ) : (
              <ul className="divide-y">
                {report.byCurrency.map((b) => (
                  <li key={b.key} className="flex items-baseline justify-between py-2 text-sm">
                    <span className="font-mono">{b.key}</span>
                    <span className="tabular-nums">
                      <span className="font-medium">{formatMoney(b.revenue, b.key)}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{salesCount(b.count)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

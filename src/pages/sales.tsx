import { useMemo, useState } from 'react'
import { DownloadIcon, PlusIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { SaleDialog } from '@/components/sale-dialog'
import { SalesTable } from '@/components/sales-table'
import { salesCsv } from '@/lib/csv'
import { download } from '@/lib/download'
import { formatMoney, saleTotalIn, today } from '@/lib/format'
import { useStore } from '@/lib/store'
import { SALE_STATUSES } from '@/lib/types'

const ALL = 'all'

export function SalesPage() {
  const { db } = useStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(ALL)
  const [year, setYear] = useState(ALL)

  const customers = useMemo(() => new Map(db.customers.map((c) => [c.id, c])), [db.customers])
  const years = useMemo(
    () => [...new Set(db.sales.map((s) => s.date.slice(0, 4)))].sort().reverse(),
    [db.sales],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.sales
      .filter((s) => status === ALL || s.status === status)
      .filter((s) => year === ALL || s.date.startsWith(year))
      .filter((s) => {
        if (!q) return true
        const c = customers.get(s.customerId)
        const haystack = [s.number, c?.name, ...(c?.contacts.map((p) => p.name) ?? []), s.notes, ...s.items.map((i) => i.description)]
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
  }, [db.sales, customers, query, status, year])

  const total = filtered
    .filter((s) => s.status !== 'cancelled')
    .reduce((sum, s) => sum + saleTotalIn(s, db.settings), 0)

  return (
    <>
      <PageHeader
        title="Sales"
        description="Everything you've sold."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => download(`sales-${today()}.csv`, salesCsv(db), 'text/csv;charset=utf-8')}
              disabled={db.sales.length === 0}
            >
              <DownloadIcon /> Export CSV
            </Button>
            <Button onClick={() => setOpen(true)}>
              <PlusIcon /> New sale
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search customer, product, notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {SALE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-muted-foreground ml-auto text-sm">
          {filtered.length} sale{filtered.length === 1 ? '' : 's'} ·{' '}
          <span className="text-foreground font-medium">{formatMoney(total, db.settings.baseCurrency)}</span>
        </div>
      </div>

      <Card className="py-2">
        <CardContent className="px-2">
          <SalesTable
            sales={filtered}
            emptyText={db.sales.length ? 'No sales match your filters.' : 'No sales yet. Record your first one!'}
          />
        </CardContent>
      </Card>

      <SaleDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/page-header'
import { SalespersonDialog } from '@/components/salesperson-dialog'
import { countsAsRevenue, formatDate, formatMoney, saleTotalIn } from '@/lib/format'
import { useStore } from '@/lib/store'

export function TeamPage() {
  const { db } = useStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const stats = new Map<string, { sales: number; revenue: number; last?: string }>()
    for (const s of db.sales) {
      if (!s.salespersonId || !countsAsRevenue(s)) continue
      const st = stats.get(s.salespersonId) ?? { sales: 0, revenue: 0 }
      st.sales += 1
      st.revenue += saleTotalIn(s, db.settings)
      if (!st.last || s.date > st.last) st.last = s.date
      stats.set(s.salespersonId, st)
    }
    const customers = new Map<string, number>()
    for (const c of db.customers) {
      if (c.salespersonId) customers.set(c.salespersonId, (customers.get(c.salespersonId) ?? 0) + 1)
    }
    const q = query.trim().toLowerCase()
    return db.salespeople
      .filter((p) => !q || [p.name, p.email, p.phone].join(' ').toLowerCase().includes(q))
      .map((p) => ({ rep: p, customers: customers.get(p.id) ?? 0, ...(stats.get(p.id) ?? { sales: 0, revenue: 0 }) }))
      .sort(
        (a, b) =>
          Number(b.rep.active) - Number(a.rep.active) || b.revenue - a.revenue || a.rep.name.localeCompare(b.rep.name),
      )
  }, [db.salespeople, db.customers, db.sales, db.settings, query])

  return (
    <>
      <PageHeader
        title="Sales team"
        description="Your colleagues who look after customers and bring in orders."
        actions={
          <Button onClick={() => setOpen(true)}>
            <PlusIcon /> New rep
          </Button>
        }
      />
      <div className="relative mb-4 w-full sm:w-72">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input className="pl-9" placeholder="Search reps…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <Card className="py-2">
        <CardContent className="px-2">
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {db.salespeople.length
                ? 'No reps match your search.'
                : 'No reps yet. Add a colleague, then assign them to companies.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue ({db.settings.baseCurrency})</TableHead>
                  <TableHead>Last sale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ rep, customers, sales, revenue, last }) => (
                  <TableRow key={rep.id}>
                    <TableCell className="font-medium">
                      <Link to={`/team/${rep.id}`} className="hover:underline">
                        {rep.name}
                      </Link>
                      {!rep.active && (
                        <Badge variant="secondary" className="ml-2">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rep.email || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{rep.phone || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{customers}</TableCell>
                    <TableCell className="text-right tabular-nums">{sales}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(revenue, db.settings.baseCurrency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(last)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <SalespersonDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

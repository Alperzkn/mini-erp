import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CustomerDialog } from '@/components/customer-dialog'
import { PageHeader } from '@/components/page-header'
import { countsAsRevenue, formatDate, formatMoney, primaryContact, saleTotalIn } from '@/lib/format'
import { useStore } from '@/lib/store'

export function CustomersPage() {
  const { db } = useStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const stats = new Map<string, { count: number; revenue: number; last?: string }>()
    for (const s of db.sales) {
      if (!countsAsRevenue(s)) continue
      const st = stats.get(s.customerId) ?? { count: 0, revenue: 0 }
      st.count += 1
      st.revenue += saleTotalIn(s, db.settings)
      if (!st.last || s.date > st.last) st.last = s.date
      stats.set(s.customerId, st)
    }
    const q = query.trim().toLowerCase()
    return db.customers
      .filter(
        (c) =>
          !q ||
          [c.name, c.email, c.country, ...c.contacts.flatMap((p) => [p.name, p.email])]
            .join(' ')
            .toLowerCase()
            .includes(q),
      )
      .map((c) => ({
        customer: c,
        ...(stats.get(c.id) ?? { count: 0, revenue: 0 }),
      }))
      .sort((a, b) => b.revenue - a.revenue || a.customer.name.localeCompare(b.customer.name))
  }, [db.customers, db.sales, db.settings, query])

  return (
    <>
      <PageHeader
        title="Customers"
        description="Who you sell to, sorted by lifetime revenue."
        actions={
          <Button onClick={() => setOpen(true)}>
            <PlusIcon /> New customer
          </Button>
        }
      />
      <div className="relative mb-4 w-full sm:w-72">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-9"
          placeholder="Search customers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <Card className="py-2">
        <CardContent className="px-2">
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {db.customers.length ? 'No customers match your search.' : 'No customers yet.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Country</TableHead>
                  {db.salespeople.length > 0 && <TableHead>Rep</TableHead>}
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue ({db.settings.baseCurrency})</TableHead>
                  <TableHead>Last purchase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ customer: c, count, revenue, last }) => {
                  const person = primaryContact(c)
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link to={`/customers/${c.id}`} className="hover:underline">
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {person ? (
                          <>
                            {person.name}
                            {person.role && <span className="text-muted-foreground"> · {person.role}</span>}
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.email || person?.email || '—'}</TableCell>
                      <TableCell>{c.country || '—'}</TableCell>
                      {db.salespeople.length > 0 && (
                        <TableCell className="text-muted-foreground">
                          {c.salespersonId && db.salespeople.some((p) => p.id === c.salespersonId) ? (
                            <Link to={`/team/${c.salespersonId}`} className="hover:underline">
                              {db.salespeople.find((p) => p.id === c.salespersonId)?.name}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums">{count}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(revenue, db.settings.baseCurrency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(last)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <CustomerDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

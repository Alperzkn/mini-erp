import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { SalesTable } from '@/components/sales-table'
import { SalespersonDialog } from '@/components/salesperson-dialog'
import { countsAsRevenue, formatMoney, primaryContact, saleTotalIn } from '@/lib/format'
import { useStore } from '@/lib/store'

export function TeamDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db, deleteSalesperson, upsertSalesperson } = useStore()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const rep = db.salespeople.find((p) => p.id === id)
  if (!rep) {
    return (
      <div className="text-muted-foreground text-sm">
        Rep not found.{' '}
        <Link to="/team" className="underline">
          Back to the team
        </Link>
      </div>
    )
  }

  const currency = db.settings.baseCurrency
  const sales = db.sales.filter((s) => s.salespersonId === rep.id).sort((a, b) => b.date.localeCompare(a.date))
  const active = sales.filter(countsAsRevenue)
  const revenue = active.reduce((sum, s) => sum + saleTotalIn(s, db.settings), 0)
  const outstanding = active
    .filter((s) => s.status === 'pending')
    .reduce((sum, s) => sum + saleTotalIn(s, db.settings), 0)
  const companies = db.customers
    .filter((c) => c.salespersonId === rep.id)
    .map((c) => {
      const theirs = db.sales.filter((s) => s.customerId === c.id && countsAsRevenue(s))
      return {
        customer: c,
        sales: theirs.length,
        revenue: theirs.reduce((sum, s) => sum + saleTotalIn(s, db.settings), 0),
      }
    })
    .sort((a, b) => b.revenue - a.revenue || a.customer.name.localeCompare(b.customer.name))
  const linked = companies.length > 0 || sales.length > 0

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
        <Link to="/team">
          <ArrowLeftIcon /> Sales team
        </Link>
      </Button>
      <PageHeader
        title={rep.name}
        description={[rep.email, rep.phone].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            {!rep.active && <Badge variant="secondary">Inactive</Badge>}
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <PencilIcon /> Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                upsertSalesperson({ ...rep, active: !rep.active })
                toast.success(rep.active ? `${rep.name} marked inactive` : `${rep.name} is active again`)
              }}
            >
              {rep.active ? 'Mark inactive' : 'Mark active'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (linked) {
                  toast.error('This rep is linked to customers or sales. Mark them inactive instead.')
                  return
                }
                setDeleteOpen(true)
              }}
            >
              <Trash2Icon /> Delete
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">Revenue brought in</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{formatMoney(revenue, currency)}</CardContent>
        </Card>
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">Awaiting payment</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {formatMoney(outstanding, currency)}
          </CardContent>
        </Card>
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">Companies</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{companies.length}</CardContent>
        </Card>
      </div>

      <Card className="mb-6 py-2">
        <CardHeader className="px-6 pt-4 pb-2">
          <CardTitle>Companies</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          {companies.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              No companies yet. Assign this rep on a customer's page.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue ({currency})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map(({ customer: c, sales: n, revenue: r }) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link to={`/customers/${c.id}`} className="hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{primaryContact(c)?.name || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{n}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(r, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="py-2">
        <CardHeader className="px-6 pt-4 pb-2">
          <CardTitle>Sales</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <SalesTable sales={sales} emptyText="No sales credited to this rep yet." />
        </CardContent>
      </Card>

      <SalespersonDialog open={editOpen} onOpenChange={setEditOpen} salesperson={rep} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${rep.name}?`}
        description="This permanently removes the rep from your team."
        onConfirm={() => {
          deleteSalesperson(rep.id)
          toast.success('Rep deleted')
          navigate('/team')
        }}
      />
    </>
  )
}

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CustomerDialog } from '@/components/customer-dialog'
import { PageHeader } from '@/components/page-header'
import { SaleDialog } from '@/components/sale-dialog'
import { SalesTable } from '@/components/sales-table'
import { countsAsRevenue, formatMoney, saleTotal } from '@/lib/format'
import { useStore } from '@/lib/store'

export function CustomerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db, deleteCustomer } = useStore()
  const [editOpen, setEditOpen] = useState(false)
  const [saleOpen, setSaleOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const customer = db.customers.find((c) => c.id === id)
  if (!customer) {
    return (
      <div className="text-muted-foreground text-sm">
        Customer not found. <Link to="/customers" className="underline">Back to customers</Link>
      </div>
    )
  }

  const sales = db.sales
    .filter((s) => s.customerId === customer.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const active = sales.filter(countsAsRevenue)
  const revenue = active.reduce((sum, s) => sum + saleTotal(s), 0)
  const outstanding = active.filter((s) => s.status === 'pending').reduce((sum, s) => sum + saleTotal(s), 0)
  const currency = db.settings.currency

  const details: [string, string | undefined][] = [
    ['Company', customer.company],
    ['Email', customer.email],
    ['Phone', customer.phone],
    ['Country', customer.country],
    ['Tax / VAT ID', customer.taxId],
  ]

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
        <Link to="/customers">
          <ArrowLeftIcon /> Customers
        </Link>
      </Button>
      <PageHeader
        title={customer.name}
        description={customer.company}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <PencilIcon /> Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (sales.length > 0) {
                  toast.error('This customer has sales. Delete those first.')
                  return
                }
                setDeleteOpen(true)
              }}
            >
              <Trash2Icon /> Delete
            </Button>
            <Button onClick={() => setSaleOpen(true)}>
              <PlusIcon /> New sale
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">Lifetime revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{formatMoney(revenue, currency)}</CardContent>
        </Card>
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">Outstanding</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {formatMoney(outstanding, currency)}
          </CardContent>
        </Card>
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {details
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="truncate">{v}</dd>
                  </div>
                ))}
            </dl>
            {customer.notes && <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">{customer.notes}</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="py-2">
        <CardContent className="px-2">
          <SalesTable sales={sales} showCustomer={false} emptyText="No sales to this customer yet." />
        </CardContent>
      </Card>

      <CustomerDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
      <SaleDialog open={saleOpen} onOpenChange={setSaleOpen} initial={{ customerId: customer.id }} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${customer.name}?`}
        description="This permanently removes the customer."
        onConfirm={() => {
          deleteCustomer(customer.id)
          toast.success('Customer deleted')
          navigate('/customers')
        }}
      />
    </>
  )
}

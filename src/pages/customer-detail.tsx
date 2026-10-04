import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, MailIcon, PencilIcon, PhoneIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ContactDialog } from '@/components/contact-dialog'
import { CustomerDialog } from '@/components/customer-dialog'
import { PageHeader } from '@/components/page-header'
import { SaleDialog } from '@/components/sale-dialog'
import { SalesTable } from '@/components/sales-table'
import { Timeline } from '@/components/timeline'
import { countsAsRevenue, formatMoney, primaryContact, saleTotalIn } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Contact } from '@/lib/types'

export function CustomerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db, deleteCustomer, deleteContact } = useStore()
  const [editOpen, setEditOpen] = useState(false)
  const [saleOpen, setSaleOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | undefined>()
  const [deletingContact, setDeletingContact] = useState<Contact | undefined>()

  const customer = db.customers.find((c) => c.id === id)
  if (!customer) {
    return (
      <div className="text-muted-foreground text-sm">
        Customer not found.{' '}
        <Link to="/customers" className="underline">
          Back to customers
        </Link>
      </div>
    )
  }

  const sales = db.sales.filter((s) => s.customerId === customer.id).sort((a, b) => b.date.localeCompare(a.date))
  const active = sales.filter(countsAsRevenue)
  const revenue = active.reduce((sum, s) => sum + saleTotalIn(s, db.settings), 0)
  const outstanding = active
    .filter((s) => s.status === 'pending')
    .reduce((sum, s) => sum + saleTotalIn(s, db.settings), 0)
  const currency = db.settings.baseCurrency
  const saleByEvent = new Map(sales.flatMap((s) => s.events.map((e) => [e.id, s] as const)))
  const activity = sales.flatMap((s) => s.events).filter((e) => e.type !== 'system')
  const main = primaryContact(customer)
  const people = [...customer.contacts].sort((a, b) => Number(!!b.primary) - Number(!!a.primary))

  const details: [string, string | undefined][] = [
    ['Email', customer.email],
    ['Phone', customer.phone],
    ['Website', customer.website],
    ['Country', customer.country],
    ['Tax / VAT ID', customer.taxId],
    ['Currency', customer.currency],
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
        description={main ? [main.name, main.role].filter(Boolean).join(', ') : undefined}
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
            {details.every(([, v]) => !v) && <p className="text-muted-foreground text-sm">No details yet.</p>}
            {customer.notes && (
              <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">{customer.notes}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>People</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingContact(undefined)
              setContactOpen(true)
            }}
          >
            <PlusIcon /> Add person
          </Button>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <p className="text-muted-foreground text-sm">No people yet. Add the person you usually deal with.</p>
          ) : (
            <ul className="divide-y">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      {p.role && <span className="text-muted-foreground text-sm">{p.role}</span>}
                      {p.primary && <Badge variant="secondary">Primary</Badge>}
                    </div>
                    <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                      {p.email && (
                        <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 hover:underline">
                          <MailIcon className="size-3.5" /> {p.email}
                        </a>
                      )}
                      {p.phone && (
                        <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 hover:underline">
                          <PhoneIcon className="size-3.5" /> {p.phone}
                        </a>
                      )}
                    </div>
                    {p.notes && <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">{p.notes}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => {
                        setEditingContact(p)
                        setContactOpen(true)
                      }}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${p.name}`}
                      onClick={() => setDeletingContact(p)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="py-2">
        <CardContent className="px-2">
          <SalesTable sales={sales} showCustomer={false} emptyText="No sales to this customer yet." />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline
            events={activity}
            saleFor={(eventId) => saleByEvent.get(eventId)}
            emptyText="No notes yet. Open a sale to add calls, emails, invoices and more to its history."
          />
        </CardContent>
      </Card>

      <CustomerDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
      <ContactDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        customerId={customer.id}
        contact={editingContact}
      />
      <SaleDialog open={saleOpen} onOpenChange={setSaleOpen} initial={{ customerId: customer.id }} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${customer.name}?`}
        description="This permanently removes the customer and its people."
        onConfirm={() => {
          deleteCustomer(customer.id)
          toast.success('Customer deleted')
          navigate('/customers')
        }}
      />
      <ConfirmDialog
        open={!!deletingContact}
        onOpenChange={(o) => !o && setDeletingContact(undefined)}
        title={`Remove ${deletingContact?.name}?`}
        description="Sales that mention this person keep the company and lose the person."
        confirmLabel="Remove"
        onConfirm={() => {
          if (deletingContact) deleteContact(customer.id, deletingContact.id)
          setDeletingContact(undefined)
          toast.success('Person removed')
        }}
      />
    </>
  )
}

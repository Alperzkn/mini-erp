import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, CheckIcon, PencilIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { SaleDialog } from '@/components/sale-dialog'
import { StatusBadge } from '@/components/status-badge'
import { EventForm, Timeline } from '@/components/timeline'
import {
  formatDate,
  formatMoney,
  formatRate,
  itemTotal,
  pairRate,
  ratesForSale,
  renewalOf,
  saleSubtotal,
  saleTotal,
  saleTotalIn,
  today,
} from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Sale } from '@/lib/types'

export function SaleDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db, upsertSale, deleteSale, addEvent, deleteEvent } = useStore()
  const [editOpen, setEditOpen] = useState(false)
  const [renewing, setRenewing] = useState<Partial<Sale> | undefined>()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const sale = db.sales.find((s) => s.id === id)
  if (!sale) {
    return (
      <div className="text-muted-foreground text-sm">
        Sale not found.{' '}
        <Link to="/sales" className="underline">
          Back to sales
        </Link>
      </div>
    )
  }

  const { settings } = db
  const base = settings.baseCurrency
  const customer = db.customers.find((c) => c.id === sale.customerId)
  const renews = sale.renewsSaleId ? db.sales.find((s) => s.id === sale.renewsSaleId) : undefined
  const renewedBy = db.sales.filter((s) => s.renewsSaleId === sale.id)
  const money = (n: number) => formatMoney(n, sale.currency)

  const facts: [string, React.ReactNode][] = [
    [
      'Customer',
      customer ? (
        <Link key="c" to={`/customers/${customer.id}`} className="hover:underline">
          {customer.name}
        </Link>
      ) : (
        'Unknown'
      ),
    ],
    ...((): [string, React.ReactNode][] => {
      const p = customer?.contacts.find((x) => x.id === sale.contactId)
      return p ? [['Contact', [p.name, p.role].filter(Boolean).join(', ')]] : []
    })(),
    ['Sale date', formatDate(sale.date)],
    ['Status', <StatusBadge key="s" status={sale.status} />],
    ['Paid on', formatDate(sale.paidDate)],
    ['Payment method', sale.paymentMethod || '—'],
    ['Renewal date', formatDate(sale.renewalDate)],
    ['Currency', sale.currency],
  ]
  if (sale.currency !== base) {
    facts.push([
      'Exchange rate',
      `1 ${sale.currency} = ${formatRate(pairRate(sale.currency, base, ratesForSale(sale, settings)))} ${base}`,
    ])
  }
  if (renews) {
    facts.push([
      'Renews',
      <Link key="r" to={`/sales/${renews.id}`} className="font-mono hover:underline">
        {renews.number}
      </Link>,
    ])
  }
  if (renewedBy.length) {
    facts.push([
      'Renewed by',
      <span key="rb" className="flex gap-2">
        {renewedBy.map((r) => (
          <Link key={r.id} to={`/sales/${r.id}`} className="font-mono hover:underline">
            {r.number}
          </Link>
        ))}
      </span>,
    ])
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeftIcon /> Back
      </Button>
      <PageHeader
        title={`Sale ${sale.number}`}
        description={`${customer?.name ?? 'Unknown customer'} · ${formatDate(sale.date)} · ${money(saleTotal(sale))}`}
        actions={
          <>
            {sale.status === 'pending' && (
              <Button
                variant="outline"
                onClick={() => {
                  upsertSale({ ...sale, status: 'paid', paidDate: today(), updatedAt: new Date().toISOString() })
                  toast.success('Marked as paid')
                }}
              >
                <CheckIcon /> Mark as paid
              </Button>
            )}
            {sale.renewalDate && renewedBy.length === 0 && (
              <Button variant="outline" onClick={() => setRenewing(renewalOf(sale))}>
                <RefreshCwIcon /> Record renewal
              </Button>
            )}
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2Icon /> Delete
            </Button>
            <Button onClick={() => setEditOpen(true)}>
              <PencilIcon /> Edit
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="grid content-start gap-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                {facts.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="min-w-0">{v}</dd>
                  </div>
                ))}
              </dl>
              {sale.notes && (
                <>
                  <Separator className="my-4" />
                  <p className="text-sm whitespace-pre-wrap">{sale.notes}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="pb-4">
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="whitespace-normal">{i.description}</TableCell>
                      <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(i.unitPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(itemTotal(i))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 ml-auto grid max-w-xs gap-1 px-2 text-sm">
                {sale.discount > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums">{money(saleSubtotal(sale))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="tabular-nums">−{money(sale.discount)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{money(saleTotal(sale))}</span>
                </div>
                {sale.currency !== base && (
                  <div className="text-muted-foreground flex justify-between text-xs">
                    <span>In {base}</span>
                    <span className="tabular-nums">{formatMoney(saleTotalIn(sale, settings), base)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="content-start lg:col-span-2">
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>Calls, emails, invoices, deliveries: anything that happened.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <EventForm
              onAdd={(e) => {
                addEvent(sale.id, e)
                toast.success('Added to history')
              }}
            />
            <Timeline events={sale.events} onDelete={(eventId) => deleteEvent(sale.id, eventId)} />
          </CardContent>
        </Card>
      </div>

      <SaleDialog open={editOpen} onOpenChange={setEditOpen} sale={sale} />
      <SaleDialog open={!!renewing} onOpenChange={(o) => !o && setRenewing(undefined)} initial={renewing} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete sale ${sale.number}?`}
        description="This permanently removes the sale and its history. Consider marking it as cancelled instead."
        onConfirm={() => {
          deleteSale(sale.id)
          toast.success('Sale deleted')
          navigate('/sales')
        }}
      />
    </>
  )
}

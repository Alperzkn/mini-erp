import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckIcon,
  EyeIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SaleDialog } from '@/components/sale-dialog'
import { StatusBadge } from '@/components/status-badge'
import { formatDate, formatMoney, renewalOf, saleTotal, today } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Sale } from '@/lib/types'

export function SalesTable({
  sales,
  showCustomer = true,
  emptyText = 'No sales yet.',
}: {
  sales: Sale[]
  showCustomer?: boolean
  emptyText?: string
}) {
  const { db, upsertSale, deleteSale } = useStore()
  const navigate = useNavigate()
  const customers = new Map(db.customers.map((c) => [c.id, c]))
  const [editing, setEditing] = useState<Sale | undefined>()
  const [renewing, setRenewing] = useState<Partial<Sale> | undefined>()
  const [deleting, setDeleting] = useState<Sale | undefined>()

  if (sales.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">{emptyText}</p>
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Date</TableHead>
            {showCustomer && <TableHead>Customer</TableHead>}
            <TableHead>Items</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Renewal</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((s) => {
            const c = customers.get(s.customerId)
            return (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/sales/${s.id}`)}>
                <TableCell className="font-mono text-xs">
                  <Link to={`/sales/${s.id}`} className="text-muted-foreground hover:text-foreground hover:underline">
                    {s.number}
                  </Link>
                </TableCell>
                <TableCell>{formatDate(s.date)}</TableCell>
                {showCustomer && (
                  <TableCell>
                    {c ? (
                      <>
                        <Link
                          to={`/customers/${c.id}`}
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.name}
                        </Link>
                        {(() => {
                          const p = c.contacts.find((x) => x.id === s.contactId)
                          return p ? <span className="text-muted-foreground"> · {p.name}</span> : null
                        })()}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="max-w-72 truncate" title={s.items.map((i) => i.description).join(', ')}>
                  {s.items
                    .map((i) => (i.quantity !== 1 ? `${i.quantity}× ${i.description}` : i.description))
                    .join(', ')}
                  {s.events.some((e) => e.type !== 'system') && (
                    <MessageSquareIcon
                      className="text-muted-foreground ml-1.5 inline size-3.5 align-[-2px]"
                      aria-label="Has notes"
                    />
                  )}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(saleTotal(s), s.currency)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={s.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(s.renewalDate)}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Actions">
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => navigate(`/sales/${s.id}`)}>
                        <EyeIcon /> Open & history
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setEditing(s)}>
                        <PencilIcon /> Edit
                      </DropdownMenuItem>
                      {s.status === 'pending' && (
                        <DropdownMenuItem
                          onSelect={() => {
                            upsertSale({ ...s, status: 'paid', paidDate: today(), updatedAt: new Date().toISOString() })
                            toast.success(`${s.number} marked as paid`)
                          }}
                        >
                          <CheckIcon /> Mark as paid
                        </DropdownMenuItem>
                      )}
                      {s.renewalDate && (
                        <DropdownMenuItem onSelect={() => setRenewing(renewalOf(s))}>
                          <RefreshCwIcon /> Record renewal
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(s)}>
                        <Trash2Icon /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <SaleDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} sale={editing} />
      <SaleDialog open={!!renewing} onOpenChange={(o) => !o && setRenewing(undefined)} initial={renewing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={`Delete sale ${deleting?.number}?`}
        description="This permanently removes the sale. Consider marking it as cancelled instead if you want to keep a record."
        onConfirm={() => {
          if (deleting) deleteSale(deleting.id)
          toast.success('Sale deleted')
          setDeleting(undefined)
        }}
      />
    </>
  )
}

import { useMemo, useState } from 'react'
import { MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { ProductDialog } from '@/components/product-dialog'
import { lineShares } from '@/lib/analytics'
import { countsAsRevenue, formatMoney } from '@/lib/format'
import { useStore } from '@/lib/store'
import { BILLINGS, PRODUCT_TYPES, type Product } from '@/lib/types'

const typeLabel = Object.fromEntries(PRODUCT_TYPES.map((t) => [t.value, t.label]))
const billingLabel = Object.fromEntries(BILLINGS.map((b) => [b.value, b.label]))

export function ProductsPage() {
  const { db, deleteProduct } = useStore()
  const [dialog, setDialog] = useState<{ open: boolean; product?: Product }>({ open: false })
  const [deleting, setDeleting] = useState<Product | undefined>()

  const revenueByProduct = useMemo(() => {
    const m = new Map<string, { units: number; revenue: number }>()
    for (const s of db.sales) {
      if (!countsAsRevenue(s)) continue
      for (const { item, amount } of lineShares(s, db, 'sale', db.settings.baseCurrency)) {
        if (!item.productId) continue
        const r = m.get(item.productId) ?? { units: 0, revenue: 0 }
        r.units += item.quantity
        r.revenue += amount
        m.set(item.productId, r)
      }
    }
    return m
  }, [db])

  const products = [...db.products].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))

  return (
    <>
      <PageHeader
        title="Products"
        description="What you sell: licenses, subscriptions, services, support."
        actions={
          <Button onClick={() => setDialog({ open: true })}>
            <PlusIcon /> New product
          </Button>
        }
      />
      <Card className="py-2">
        <CardContent className="px-2">
          {products.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No products yet. Products are optional, but they make recording sales faster.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Units sold</TableHead>
                  <TableHead className="text-right">Revenue ({db.settings.baseCurrency})</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const stats = revenueByProduct.get(p.id)
                  return (
                    <TableRow key={p.id} className={p.active ? '' : 'opacity-60'}>
                      <TableCell className="font-medium">
                        {p.name}
                        {p.licenses.length > 0 && (
                          <span className="text-muted-foreground ml-2 text-xs font-normal">
                            {p.licenses.length} {p.licenses.length === 1 ? 'license' : 'licenses'}
                          </span>
                        )}
                        {!p.active && (
                          <Badge variant="outline" className="ml-2">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{typeLabel[p.type]}</TableCell>
                      <TableCell>{billingLabel[p.billing]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.licenses.length > 0
                          ? `from ${formatMoney(Math.min(...p.licenses.map((l) => l.price)), p.licenses[0].currency)}`
                          : formatMoney(p.price, p.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{stats?.units ?? 0}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(stats?.revenue ?? 0, db.settings.baseCurrency)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Actions">
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setDialog({ open: true, product: p })}>
                              <PencilIcon /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                if (db.sales.some((s) => s.items.some((i) => i.productId === p.id))) {
                                  toast.error('This product is used in sales. Mark it inactive instead.')
                                  return
                                }
                                setDeleting(p)
                              }}
                            >
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
          )}
        </CardContent>
      </Card>
      <ProductDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        product={dialog.product}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={`Delete ${deleting?.name}?`}
        description="This permanently removes the product."
        onConfirm={() => {
          if (deleting) deleteProduct(deleting.id)
          toast.success('Product deleted')
          setDeleting(undefined)
        }}
      />
    </>
  )
}

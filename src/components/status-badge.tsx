import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SaleStatus } from '@/lib/types'

const styles: Record<SaleStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  cancelled: 'bg-muted text-muted-foreground line-through',
}

export function StatusBadge({ status }: { status: SaleStatus }) {
  return (
    <Badge variant="secondary" className={cn('capitalize', styles[status])}>
      {status}
    </Badge>
  )
}

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A titled group of fields inside a form. */
export function FormSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  /** Optional control shown on the title row, e.g. an "Add" button. */
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('grid gap-4 border-t pt-5 first:border-t-0 first:pt-0', className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

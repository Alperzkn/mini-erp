import { cloneElement, isValidElement, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * A labelled form control with optional hint and inline error. When `error`
 * is set and the child is a single element, it is marked `aria-invalid` so
 * inputs, textareas and comboboxes pick up their invalid styling.
 */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}) {
  const control =
    error && isValidElement<{ 'aria-invalid'?: boolean }>(children)
      ? cloneElement(children, { 'aria-invalid': true })
      : children
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="text-destructive -ml-1" aria-hidden>
            *
          </span>
        )}
      </Label>
      {control}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  )
}

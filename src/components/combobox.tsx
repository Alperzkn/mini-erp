import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboOption {
  value: string
  label: string
  /** Secondary text shown on the right of the row, e.g. a price or a role. */
  hint?: string
}

/**
 * A searchable single-select. Type to filter; arrows, Enter and Escape work.
 * With `onCreate`, a final row offers to create what was typed.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  emptyText = 'No matches',
  createLabel = 'Create new',
  onCreate,
  disabled,
  id,
  className,
  ...rest
}: {
  value: string
  onChange: (value: string) => void
  options: ComboOption[]
  placeholder?: string
  emptyText?: string
  createLabel?: string
  onCreate?: (query: string) => void
  disabled?: boolean
  id?: string
  className?: string
  'aria-invalid'?: boolean
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q)) : options
  }, [options, query])
  const rows = filtered.length + (onCreate ? 1 : 0)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    )
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
    // Only runs when the popover opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (i: number) => {
    if (i < filtered.length) {
      onChange(filtered[i].value)
      setOpen(false)
    } else if (onCreate) {
      setOpen(false)
      onCreate(query.trim())
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, rows - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (rows) choose(Math.min(active, rows - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const row = (i: number, content: React.ReactNode, extra?: string) => (
    <li
      role="option"
      aria-selected={i < filtered.length && filtered[i].value === value}
      data-active={i === active ? '' : undefined}
      onMouseEnter={() => setActive(i)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => choose(i)}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
        i === active && 'bg-accent text-accent-foreground',
        extra,
      )}
    >
      {content}
    </li>
  )

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={rest['aria-invalid'] || undefined}
          aria-label={rest['aria-label']}
          className={cn(
            'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-50 w-[var(--radix-popover-trigger-width)] min-w-56 overflow-hidden rounded-md border shadow-md"
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              // The list changes under the cursor, so start from the top again.
              setActive(0)
            }}
            onKeyDown={onKey}
            placeholder="Type to search…"
            role="searchbox"
            aria-controls={listId}
            className="placeholder:text-muted-foreground h-9 w-full border-b bg-transparent px-3 text-sm outline-none"
          />
          <ul id={listId} ref={listRef} role="listbox" className="max-h-64 overflow-y-auto p-1">
            {filtered.map((o, i) =>
              row(
                i,
                <>
                  <CheckIcon className={cn('size-4 shrink-0', o.value === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{o.label}</span>
                  {o.hint && <span className="text-muted-foreground ml-auto shrink-0 pl-2 text-xs">{o.hint}</span>}
                </>,
              ),
            )}
            {filtered.length === 0 && !onCreate && (
              <li className="text-muted-foreground px-2 py-4 text-center text-sm">{emptyText}</li>
            )}
            {onCreate &&
              row(
                filtered.length,
                <>
                  <PlusIcon className="size-4 shrink-0" />
                  <span className="truncate">
                    {createLabel}
                    {query.trim() ? ` “${query.trim()}”` : ''}
                  </span>
                </>,
                filtered.length > 0 ? 'mt-1 border-t pt-2' : undefined,
              )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

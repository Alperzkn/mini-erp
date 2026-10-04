import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeDollarSignIcon,
  CalendarIcon,
  CircleDotIcon,
  FileTextIcon,
  KeyRoundIcon,
  LifeBuoyIcon,
  MailIcon,
  PhoneIcon,
  StickyNoteIcon,
  Trash2Icon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, today } from '@/lib/format'
import { EVENT_LABELS, EVENT_TYPES, type EventType, type Sale, type SaleEvent } from '@/lib/types'
import { cn } from '@/lib/utils'

const ICONS: Record<EventType, LucideIcon> = {
  note: StickyNoteIcon,
  call: PhoneIcon,
  email: MailIcon,
  meeting: UsersIcon,
  invoice: FileTextIcon,
  payment: BadgeDollarSignIcon,
  delivery: KeyRoundIcon,
  support: LifeBuoyIcon,
  system: CircleDotIcon,
}

/** Newest first; same-day entries by when they were added. */
function sortEvents<T extends SaleEvent>(events: T[]): T[] {
  return [...events].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export function EventForm({ onAdd }: { onAdd: (e: Omit<SaleEvent, 'id' | 'createdAt'>) => void }) {
  const [type, setType] = useState<EventType>('note')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return
    onAdd({ type, date: date || today(), note: note.trim() })
    setNote('')
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <Textarea
        placeholder="What happened? e.g. Sent invoice #2024-15, customer asked for 2 more seats…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={type} onValueChange={(v) => v && setType(v as EventType)}>
          <SelectTrigger className="w-44" size="sm" aria-label="Event type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          aria-label="Event date"
          className="h-9 w-40"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button type="submit" size="sm" className="ml-auto" disabled={!note.trim()}>
          Add to history
        </Button>
      </div>
    </form>
  )
}

export function Timeline({
  events,
  onDelete,
  saleFor,
  emptyText = 'Nothing recorded yet.',
}: {
  events: SaleEvent[]
  onDelete?: (id: string) => void
  /** When given, each entry links to its sale (used on the customer page). */
  saleFor?: (eventId: string) => Sale | undefined
  emptyText?: string
}) {
  if (events.length === 0) return <p className="text-muted-foreground text-sm">{emptyText}</p>
  return (
    <ol className="relative">
      {sortEvents(events).map((e, i, all) => {
        const Icon = ICONS[e.type] ?? CircleDotIcon
        const system = e.type === 'system'
        const sale = saleFor?.(e.id)
        return (
          <li key={e.id} className="group relative flex gap-3 pb-4 last:pb-0">
            {i < all.length - 1 && <span className="bg-border absolute top-7 bottom-0 left-[13px] w-px" aria-hidden />}
            <span
              className={cn(
                'bg-background relative flex size-7 shrink-0 items-center justify-center rounded-full border',
                system && 'text-muted-foreground',
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                <span className="text-foreground font-medium">{EVENT_LABELS[e.type]}</span>
                <span className="flex items-center gap-1">
                  <CalendarIcon className="size-3" />
                  {formatDate(e.date)}
                </span>
                {sale && (
                  <Link to={`/sales/${sale.id}`} className="font-mono hover:underline">
                    {sale.number}
                  </Link>
                )}
              </div>
              <p className={cn('mt-0.5 text-sm break-words whitespace-pre-wrap', system && 'text-muted-foreground')}>
                {e.note}
              </p>
            </div>
            {onDelete && !system && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Delete entry"
                onClick={() => onDelete(e.id)}
              >
                <Trash2Icon />
              </Button>
            )}
          </li>
        )
      })}
    </ol>
  )
}

import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

/** Parses what a person types: "1.", "1,5" and "" are all fine mid-edit. */
function parse(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!t || t === '-' || t === '.' || t === '-.') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/**
 * A number field that behaves like a text field while you type: the whole
 * value is selected on focus so typing replaces it, and it can be emptied or
 * hold "1." mid-edit without snapping back. An empty field commits 0 on blur.
 */
export function NumberInput({
  value,
  onChange,
  onFocus,
  onBlur,
  onMouseUp,
  min,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'min'> & {
  value: number
  onChange: (value: number) => void
  min?: number | string
}) {
  // Only used while focused; otherwise the field mirrors `value`.
  const [draft, setDraft] = useState<string | null>(null)
  const selectOnMouseUp = useRef(false)
  const floor = min === undefined ? undefined : Number(min)
  const clamp = (n: number) => (floor !== undefined && n < floor ? floor : n)

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      {...props}
      value={draft ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value))
        e.currentTarget.select()
        // A mouse click would otherwise drop the selection to a caret.
        selectOnMouseUp.current = true
        onFocus?.(e)
      }}
      onMouseUp={(e) => {
        if (selectOnMouseUp.current) {
          e.preventDefault()
          selectOnMouseUp.current = false
        }
        onMouseUp?.(e)
      }}
      onChange={(e) => {
        setDraft(e.target.value)
        const n = parse(e.target.value)
        if (n !== null) onChange(clamp(n))
      }}
      onBlur={(e) => {
        const n = parse(draft ?? '')
        onChange(clamp(n ?? 0))
        setDraft(null)
        selectOnMouseUp.current = false
        onBlur?.(e)
      }}
    />
  )
}

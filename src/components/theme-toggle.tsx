import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme, type Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const options: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
]

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className={cn('bg-muted inline-flex rounded-md p-0.5', className)}>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            'text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs transition-colors',
            theme === value && 'bg-background text-foreground shadow-xs',
          )}
        >
          <Icon className="size-3.5" />
          <span className="sr-only sm:not-sr-only md:sr-only lg:not-sr-only">{label}</span>
        </button>
      ))}
    </div>
  )
}

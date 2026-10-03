import { Moon, Smartphone, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

const OPTIONS = [
  { value: 'light', Icon: Sun, label: () => tr('Clair') },
  { value: 'dark', Icon: Moon, label: () => tr('Sombre') },
  { value: 'system', Icon: Smartphone, label: () => tr('Système') },
] as const

/** Appearance choice: Light / Dark / follow the device. Stored on this device. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  return (
    <div role="radiogroup" aria-label={tr('Apparence')} className={cn('grid grid-cols-3 gap-2', className)}>
      {OPTIONS.map(({ value, Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition-colors',
            theme === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50',
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
          {label()}
        </button>
      ))}
    </div>
  )
}

/** Compact header button: switches between light and dark in one tap. */
export function ThemeQuickToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark' || (theme === 'system' && typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  return (
    <button
      type="button"
      aria-label={isDark ? tr('Passer en mode clair') : tr('Passer en mode sombre')}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn('flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted', className)}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  )
}

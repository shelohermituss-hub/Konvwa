import { useI18n } from '@/lib/i18n-context'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { code: 'fr', short: 'FR', label: 'Français' },
  { code: 'en', short: 'EN', label: 'English' },
] as const

/** Two-way FR / EN switch. Changing the language reloads the app (see lib/i18n.ts). */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n()
  return (
    <div role="group" aria-label="Language / Langue" className={cn('inline-flex items-center rounded-full border border-border bg-background/80 p-0.5', className)}>
      {OPTIONS.map((o) => (
        <button
          key={o.code}
          type="button"
          lang={o.code}
          aria-label={o.label}
          aria-pressed={lang === o.code}
          onClick={() => { if (lang !== o.code) setLang(o.code) }}
          className={cn(
            'h-8 min-w-9 rounded-full px-2.5 text-xs font-bold transition-colors',
            lang === o.code ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.short}
        </button>
      ))}
    </div>
  )
}

import { CURRENCY, setCurrency, type Currency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

const OPTIONS: Array<{ code: Currency; short: string; label: string }> = [
  { code: 'HTG', short: 'HTG', label: 'Gourdes (HTG)' },
  { code: 'USD', short: 'USD', label: 'Dollars US (USD)' },
]

/** HTG / USD display switch: amounts are always computed in HTG, this only changes how they are shown. Changing it reloads the app (see lib/currency.ts). */
export function CurrencyToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  if (compact) {
    // one small button for crowded headers: it shows the current currency and switches to the other one
    const other = CURRENCY === 'HTG' ? 'USD' : 'HTG'
    return (
      <button
        type="button"
        aria-label={tr('Devise d\'affichage : {0}. Passer en {1}', CURRENCY, other)}
        onClick={() => setCurrency(other)}
        className={cn('h-8 rounded-full border border-border bg-background/80 px-2.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted', className)}
      >
        {CURRENCY}
      </button>
    )
  }
  return (
    <div role="group" aria-label={tr('Devise d\'affichage')} className={cn('inline-flex items-center rounded-full border border-border bg-background/80 p-0.5', className)}>
      {OPTIONS.map((o) => (
        <button
          key={o.code}
          type="button"
          aria-label={o.label}
          aria-pressed={CURRENCY === o.code}
          onClick={() => { if (CURRENCY !== o.code) setCurrency(o.code) }}
          className={cn(
            'h-8 min-w-10 rounded-full px-2 text-[11px] font-bold transition-colors',
            CURRENCY === o.code ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.short}
        </button>
      ))}
    </div>
  )
}

import { Flag } from '@/components/shared/flag'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

export type CatalogMode = 'retail' | 'wholesale'

/**
 * The two shelves of the catalogue as filters: finished products sold by the unit (USA), and bulk sourcing with a minimum order quantity (China).
 * The feed shows both by default; a tap on a shelf keeps only that one, a second tap on it puts both back.
 */
export function CatalogSwitch({ value, onChange }: { value: CatalogMode | null; onChange: (next: CatalogMode | null) => void }) {
  const items = [
    { mode: 'retail' as const, flag: 'US', title: tr('Boutique'), sub: tr('Par unité · clients finaux') },
    { mode: 'wholesale' as const, flag: 'CN', title: tr('Sourcing gros'), sub: tr('En gros · quantité minimum') },
  ]
  return (
    <div role="group" aria-label={tr('Rayons du catalogue')} className="grid grid-cols-2 gap-2 px-4 pb-3">
      {items.map(({ mode: m, flag, title, sub }) => {
        const on = value === m
        return (
          <button
            key={m}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : m)}
            className={cn(
              'flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors active:scale-[0.98]',
              on ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:border-gray-300',
            )}
          >
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', on ? 'bg-primary/10' : 'bg-gray-100')}>
              <Flag code={flag} className="text-[22px]" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className={cn('block truncate text-sm font-bold', on ? 'text-primary' : 'text-foreground')}>{title}</span>
              <span className="block truncate text-[10.5px] text-muted-foreground">{sub}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

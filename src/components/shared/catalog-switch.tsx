import { Link } from 'react-router-dom'
import { Boxes, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

export type CatalogMode = 'retail' | 'wholesale'

/** The two shelves of the catalogue, side by side: finished products sold by the unit, and bulk sourcing with a minimum order quantity. */
export function CatalogSwitch({ mode }: { mode: CatalogMode }) {
  const items = [
    { mode: 'retail' as const, to: '/products', Icon: Store, title: tr('Boutique'), sub: tr('Par unité · clients finaux') },
    { mode: 'wholesale' as const, to: '/wholesale', Icon: Boxes, title: tr('Sourcing gros'), sub: tr('En gros · quantité minimum') },
  ]
  return (
    <nav aria-label={tr('Rayons du catalogue')} className="grid grid-cols-2 gap-2 px-4 pb-3">
      {items.map(({ mode: m, to, Icon, title, sub }) => (
        <Link
          key={m}
          to={to}
          replace
          aria-current={mode === m ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 transition-colors active:scale-[0.98]',
            mode === m ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:border-gray-300',
          )}
        >
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', mode === m ? 'bg-primary text-white' : 'bg-gray-100 text-muted-foreground')}>
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 leading-tight">
            <span className={cn('block truncate text-sm font-bold', mode === m ? 'text-primary' : 'text-foreground')}>{title}</span>
            <span className="block truncate text-[10.5px] text-muted-foreground">{sub}</span>
          </span>
        </Link>
      ))}
    </nav>
  )
}

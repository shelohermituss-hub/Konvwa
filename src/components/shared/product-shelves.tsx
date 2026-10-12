import { BadgePercent, ChevronRight, Flame, Heart, Smartphone, Tag, Store } from 'lucide-react'
import { ProductCard } from '@/components/shared/product-card'
import { shelfKey, type Shelf, type ShelfRef } from '@/lib/shelves'
import type { CatalogProduct } from '@/lib/catalog'
import { tr } from '@/lib/i18n'

export function shelfTitle(r: ShelfRef): string {
  switch (r.kind) {
    case 'sale': return tr('Réductions')
    case 'offers': return tr('Offres du moment')
    case 'featured': return tr('Coups de cœur')
    case 'category': return tr(r.value)
    case 'brand': return tr('Sélection {0}', r.value)
  }
}

function ShelfIcon({ r }: { r: ShelfRef }) {
  const cls = 'h-4 w-4 text-primary'
  if (r.kind === 'sale') return <BadgePercent className={cls} aria-hidden />
  if (r.kind === 'offers') return <Flame className={cls} aria-hidden />
  if (r.kind === 'featured') return <Heart className={cls} aria-hidden />
  if (r.kind === 'brand') return <Store className={cls} aria-hidden />
  return r.value === 'Électronique' ? <Smartphone className={cls} aria-hidden /> : <Tag className={cls} aria-hidden />
}

/** The home feed's themed rows (offers, favourites, electronics…): each scrolls sideways, "See all" opens the whole shelf as a filtered feed. */
export function ProductShelves({ shelves, onSeeAll, onPress }: {
  shelves: Shelf[]
  onSeeAll: (ref: ShelfRef) => void
  onPress: (product: CatalogProduct) => void
}) {
  if (shelves.length === 0) return null
  return (
    <div className="space-y-5 pb-5">
      {shelves.map((shelf) => (
        <section key={shelfKey(shelf.ref)} aria-label={shelfTitle(shelf.ref)}>
          <div className="mb-2 flex items-center justify-between px-4">
            <h2 className="flex items-center gap-2 text-base font-bold tracking-tight"><ShelfIcon r={shelf.ref} />{shelfTitle(shelf.ref)}</h2>
            <button type="button" onClick={() => onSeeAll(shelf.ref)} className="flex items-center gap-0.5 text-xs font-bold text-primary">
              {tr('Voir tout')}<ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="scrollbar-none flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
            {shelf.items.map((p) => (
              <div key={p.id} className="w-[44vw] max-w-[190px] shrink-0 snap-start [&>div]:mb-0 [&>div]:h-full">
                <ProductCard product={p} onPress={() => onPress(p)} uniform />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

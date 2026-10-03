import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWishlist } from '@/lib/wishlist-context'
import { tr } from '@/lib/i18n'

export function WishlistButton({ productId, className }: { productId: string; className?: string }) {
  const { has, toggle } = useWishlist()
  const active = has(productId)
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); void toggle(productId) }}
      aria-pressed={active}
      aria-label={active ? tr('Retirer des favoris') : tr('Ajouter aux favoris')}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-transform active:scale-90',
        className,
      )}
    >
      <Heart className={cn('h-[18px] w-[18px]', active ? 'fill-primary text-primary' : 'text-foreground/70')} strokeWidth={1.8} />
    </button>
  )
}

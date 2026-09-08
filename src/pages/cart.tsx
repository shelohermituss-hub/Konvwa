import { useNavigate } from 'react-router-dom'
import { Trash2, Minus, Plus, Package, ArrowRight, ChevronLeft } from 'lucide-react'
import { useCart } from '@/lib/cart-context'
import { useI18n } from '@/lib/i18n-context'
import { cn } from '@/lib/utils'
import { IllustrationEmptyCart } from '@/components/shared/illustrations'

export function CartPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { items, total, loading, updateQuantity, removeItem } = useCart()

  return (
    <div className="min-h-full bg-[#F4F5F7] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-white/95 backdrop-blur-md px-4 border-b border-gray-100 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="font-bold">{t('cart.title')}</h1>
        {items.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {items.length} {t('cart.items')}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16 px-8 gap-3 text-center">
          <IllustrationEmptyCart className="w-48 h-auto" />
          <div>
            <p className="font-bold text-base">{t('cart.empty')}</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t('cart.empty_sub')}</p>
          </div>
          <button
            onClick={() => navigate('/products')}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
          >
            {t('cart.browse')}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {items.map(item => {
            const product = item.products
            const subtotal = (product?.price_htg ?? 0) * item.quantity
            const hasImage = product?.images?.length > 0

            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex gap-3">
                {/* Thumbnail */}
                <div className="h-16 w-16 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                  {hasImage ? (
                    <img src={product.images[0]} alt={product?.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-7 w-7 text-muted-foreground/25" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-snug line-clamp-2">{product?.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(product?.price_htg ?? 0).toLocaleString('fr-HT')} HTG / {product?.unit}
                  </p>

                  <div className="flex items-center justify-between mt-2.5">
                    {/* Stepper */}
                    <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1 border border-gray-100">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className={cn(
                          'h-6 w-6 flex items-center justify-center rounded-md transition-colors',
                          item.quantity <= (product?.moq ?? 1)
                            ? 'text-muted-foreground/30 cursor-not-allowed'
                            : 'hover:bg-white text-muted-foreground'
                        )}
                        disabled={item.quantity <= (product?.moq ?? 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-white transition-colors text-muted-foreground"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Subtotal + remove */}
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-primary">{subtotal.toLocaleString('fr-HT')} HTG</p>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/8 hover:text-destructive text-muted-foreground/50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bottom checkout bar */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_20px_rgba(10,22,40,0.08)] px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground font-medium">{t('cart.total')}</span>
            <span className="text-xl font-black text-primary">{total.toLocaleString('fr-HT')} HTG</span>
          </div>
          <button
            onClick={() => navigate('/checkout')}
            className="w-full flex items-center justify-center gap-2 h-13 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
          >
            {t('cart.checkout')}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

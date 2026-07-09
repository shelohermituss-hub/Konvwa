import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ShoppingCart, Package, Truck, CheckCircle, Minus, Plus, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/lib/cart-context'
import { useI18n } from '@/lib/i18n-context'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  name: string
  description: string | null
  price_htg: number
  moq: number
  unit: string
  supplier_name: string | null
  category: string | null
  delivery_days_min: number | null
  delivery_days_max: number | null
  images: string[]
  specifications: Record<string, string>
  stock_available: boolean
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { addItem, count } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [activeImg, setActiveImg] = useState(0)

  useEffect(() => {
    if (!id) return
    supabase
      .from('products')
      .select('id, name, description, price_htg, moq, unit, supplier_name, category, delivery_days_min, delivery_days_max, images, specifications, stock_available')
      .eq('id', id)
      .eq('active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProduct(data as Product)
          setQuantity((data as Product).moq)
        }
        setLoading(false)
      })
  }, [id])

  async function handleAddToCart() {
    if (!product) return
    setAdding(true)
    await addItem(product.id, quantity)
    setAdding(false)
    toast.success(t('products.added'), {
      description: `${quantity} × ${product.name}`,
      action: { label: 'Voir panier', onClick: () => navigate('/cart') },
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary/60" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex flex-col items-center justify-center gap-3 px-8 text-center">
        <Package className="h-12 w-12 text-muted-foreground/30" />
        <p className="font-semibold">Produit introuvable</p>
        <button onClick={() => navigate('/products')} className="text-sm text-primary font-medium">
          Retour aux produits
        </button>
      </div>
    )
  }

  const subtotal = product.price_htg * quantity

  return (
    <div className="min-h-full bg-[#F4F5F7] pb-32">
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-white/95 backdrop-blur-md px-4 border-b border-gray-100 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigate('/cart')}
          className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <ShoppingCart className="h-5 w-5" strokeWidth={1.8} />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
      </div>

      {/* Images */}
      <div className="bg-white">
        <div className="w-full aspect-square bg-gray-50 overflow-hidden flex items-center justify-center">
          {product.images.length > 0 ? (
            <img src={product.images[activeImg]} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <Package className="h-20 w-20 text-muted-foreground/20" />
          )}
        </div>
        {product.images.length > 1 && (
          <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
            {product.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={cn(
                  'shrink-0 h-14 w-14 rounded-xl overflow-hidden border-2 transition-colors',
                  activeImg === i ? 'border-primary' : 'border-gray-100'
                )}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-4">
        {/* Title + price */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          {product.category && (
            <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/8 px-2.5 py-0.5 rounded-full mb-2">
              {product.category}
            </span>
          )}
          <h1 className="text-xl font-bold leading-snug">{product.name}</h1>
          {product.supplier_name && (
            <p className="text-sm text-muted-foreground mt-1">{product.supplier_name}</p>
          )}
          <div className="flex items-end gap-3 mt-3">
            <div>
              <p className="text-2xl font-black text-primary">
                {product.price_htg.toLocaleString('fr-HT')}
                <span className="text-sm font-semibold text-muted-foreground"> HTG / {product.unit}</span>
              </p>
            </div>
            {!product.stock_available && (
              <span className="text-xs font-bold text-destructive bg-destructive/8 px-2.5 py-1 rounded-full">
                Rupture de stock
              </span>
            )}
          </div>
        </div>

        {/* Key info chips */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
            <Package className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">{t('products.moq')}</p>
            <p className="text-sm font-bold">{product.moq} {product.unit}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
            <Truck className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">{t('products.delivery')}</p>
            <p className="text-sm font-bold">
              {product.delivery_days_min
                ? `${product.delivery_days_min}–${product.delivery_days_max ?? product.delivery_days_min}j`
                : '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
            <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">Statut</p>
            <p className={cn('text-sm font-bold', product.stock_available ? 'text-emerald-600' : 'text-destructive')}>
              {product.stock_available ? 'Disponible' : 'Indispo.'}
            </p>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <h2 className="text-sm font-bold mb-2">Description</h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{product.description}</p>
          </div>
        )}

        {/* Specifications */}
        {Object.keys(product.specifications).length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <h2 className="text-sm font-bold mb-3">{t('products.specifications')}</h2>
            <div className="space-y-2">
              {Object.entries(product.specifications).map(([key, val]) => (
                <div key={key} className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
                  <p className="text-xs text-muted-foreground">{key}</p>
                  <p className="text-xs font-semibold text-right">{val}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_20px_rgba(10,22,40,0.08)] px-4 py-3 safe-b">
        <div className="flex items-center gap-3">
          {/* Quantity stepper */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-2 py-1 border border-gray-200">
            <button
              onClick={() => setQuantity(q => Math.max(product.moq, q - 1))}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors text-muted-foreground"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-10 text-center text-sm font-bold">{quantity}</span>
            <button
              onClick={() => setQuantity(q => q + 1)}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors text-muted-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Add to cart */}
          <button
            onClick={handleAddToCart}
            disabled={adding || !product.stock_available}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                {t('products.add_to_cart')} · {subtotal.toLocaleString('fr-HT')} HTG
              </>
            )}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          Min. {product.moq} {product.unit} · Prix / {product.unit} : {product.price_htg.toLocaleString('fr-HT')} HTG
        </p>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ShoppingCart, Package, Loader2, Tag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/lib/cart-context'
import { useI18n } from '@/lib/i18n-context'
import { cn } from '@/lib/utils'
import { IllustrationEmptyProducts } from '@/components/shared/illustrations'

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
  stock_available: boolean
  featured: boolean
}

export function ProductsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { count } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('products')
        .select('id, name, description, price_htg, moq, unit, supplier_name, category, delivery_days_min, delivery_days_max, images, stock_available, featured')
        .eq('active', true)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false })
      if (data) setProducts(data as Product[])
      setLoading(false)
    }
    load()
  }, [])

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[]

  const filtered = products.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.supplier_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !activeCategory || p.category === activeCategory
    return matchSearch && matchCat
  })

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('products.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('products.subtitle')}</p>
        </div>
        <button
          onClick={() => navigate('/cart')}
          className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-gray-100 shadow-sm"
        >
          <ShoppingCart className="h-5 w-5 text-foreground" strokeWidth={1.8} />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white leading-none">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('products.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 h-11 rounded-xl bg-white border border-gray-200 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors',
              !activeCategory
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white border border-gray-200 text-muted-foreground'
            )}
          >
            {t('products.all_categories')}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors',
                activeCategory === cat
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-muted-foreground'
              )}
            >
              <Tag className="h-3 w-3" />
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-primary/60" />
            <p className="text-sm text-muted-foreground">Chargement…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <IllustrationEmptyProducts className="w-48 h-auto" />
            <p className="text-sm font-bold mt-1">{t('products.empty')}</p>
            <p className="text-xs text-muted-foreground text-center max-w-[200px] leading-relaxed">{t('products.empty_sub')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(product => (
              <ProductCard key={product.id} product={product} onPress={() => navigate(`/products/${product.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const { t } = useI18n()
  const hasImage = product.images.length > 0

  return (
    <button
      onClick={onPress}
      className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-left active:scale-[0.98] transition-transform duration-100"
    >
      {/* Image / placeholder */}
      <div className="w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden relative">
        {hasImage ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 w-full h-full"
            style={{ background: 'linear-gradient(140deg, #F4F5F7 0%, #EEF0F3 100%)' }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 shadow-sm">
              <Package className="h-5 w-5 text-primary/40" strokeWidth={1.5} />
            </div>
            {product.category && (
              <span className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider px-2 text-center leading-tight">
                {product.category}
              </span>
            )}
          </div>
        )}
        {product.featured && (
          <span className="absolute top-2 left-2 bg-primary text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
            Vedette
          </span>
        )}
        {!product.stock_available && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-[10px] font-bold text-destructive bg-white/90 px-2 py-1 rounded-full border border-destructive/20">
              {t('products.out_of_stock')}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex flex-col gap-1 flex-1">
        <p className="text-xs font-bold text-foreground leading-snug line-clamp-2">{product.name}</p>
        {product.supplier_name && (
          <p className="text-[10px] text-muted-foreground truncate">{product.supplier_name}</p>
        )}
        <div className="mt-auto pt-1.5 flex items-end justify-between gap-1">
          <div>
            <p className="text-sm font-black text-primary leading-none">
              {product.price_htg.toLocaleString('fr-HT')}
              <span className="text-[10px] font-semibold text-muted-foreground"> HTG</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Min. {product.moq} {product.unit}
            </p>
          </div>
          {product.delivery_days_min && (
            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
              {product.delivery_days_min}–{product.delivery_days_max ?? product.delivery_days_min}j
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

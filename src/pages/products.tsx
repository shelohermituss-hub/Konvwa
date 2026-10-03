import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, ShoppingCart, Loader2, Tag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/lib/cart-context'
import { useI18n } from '@/lib/i18n-context'
import { cn } from '@/lib/utils'
import { IllustrationEmptyProducts } from '@/components/shared/illustrations'
import { ProductCard } from '@/components/shared/product-card'
import { CATALOG_LIST_SELECT, type CatalogProduct } from '@/lib/catalog'

export function ProductsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { count } = useCart()
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('products')
        .select(CATALOG_LIST_SELECT)
        .eq('active', true)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false })
      if (data) setProducts(data as unknown as CatalogProduct[])
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
          <div className="columns-2 gap-3">
            {filtered.map(product => (
              <ProductCard key={product.id} product={product} onPress={() => navigate(`/products/${product.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

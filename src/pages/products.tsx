import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, ShoppingCart, Loader2, Tag, SlidersHorizontal } from 'lucide-react'
import { priceRange } from '@/lib/product-pricing'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/lib/cart-context'
import { useI18n } from '@/lib/i18n-context'
import { cn } from '@/lib/utils'
import { IllustrationEmptyProducts } from '@/components/shared/illustrations'
import { ProductCard } from '@/components/shared/product-card'
import { CATALOG_LIST_SELECT, localizeProduct, type CatalogProduct } from '@/lib/catalog'

import { tr } from '@/lib/i18n'
export function ProductsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { count } = useCart()
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState<'default' | 'price_asc' | 'price_desc' | 'popular'>('default')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [maxMoq, setMaxMoq] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [inStockOnly, setInStockOnly] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('products')
        .select(CATALOG_LIST_SELECT)
        .eq('active', true)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false })
      if (data) setProducts((data as unknown as CatalogProduct[]).map(localizeProduct))
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
    const price = priceRange(p).min
    const matchPrice = (!minPrice || price >= Number(minPrice)) && (!maxPrice || price <= Number(maxPrice))
    const matchMoq = !maxMoq || p.moq <= Number(maxMoq)
    const matchVerified = !verifiedOnly || p.supplier_verified
    const matchStock = !inStockOnly || p.stock_available
    return matchSearch && matchCat && matchPrice && matchMoq && matchVerified && matchStock
  }).sort((a, b) => {
    if (sort === 'price_asc') return priceRange(a).min - priceRange(b).min
    if (sort === 'price_desc') return priceRange(b).min - priceRange(a).min
    if (sort === 'popular') return (b.sold_count ?? 0) - (a.sold_count ?? 0)
    return 0
  })

  const activeFilters = [minPrice, maxPrice, maxMoq].filter(Boolean).length + (verifiedOnly ? 1 : 0) + (inStockOnly ? 1 : 0) + (sort !== 'default' ? 1 : 0)

  function resetFilters() {
    setSort('default'); setMinPrice(''); setMaxPrice(''); setMaxMoq(''); setVerifiedOnly(false); setInStockOnly(false)
  }

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
          aria-label={tr('Panier')}
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
      <div className="flex gap-2 px-4 pb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('products.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 h-11 rounded-xl bg-white border border-gray-200 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(v => !v)}
          aria-expanded={showFilters}
          aria-label={tr('Filtres')}
          className={cn('relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', showFilters || activeFilters > 0 ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 bg-white text-foreground')}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilters > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">{activeFilters}</span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="mx-4 mb-3 space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div>
            <label htmlFor="f-sort" className="mb-1 block text-xs font-semibold text-muted-foreground">{tr('Trier par')}</label>
            <select id="f-sort" value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm">
              <option value="default">{tr('Pertinence')}</option>
              <option value="popular">{tr('Plus vendus')}</option>
              <option value="price_asc">{tr('Prix croissant')}</option>
              <option value="price_desc">{tr('Prix décroissant')}</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="f-min" className="mb-1 block text-xs font-semibold text-muted-foreground">{tr('Prix min')}</label>
              <input id="f-min" inputMode="numeric" value={minPrice} onChange={e => setMinPrice(e.target.value.replace(/\D/g, ''))} placeholder="0" className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" />
            </div>
            <div>
              <label htmlFor="f-max" className="mb-1 block text-xs font-semibold text-muted-foreground">{tr('Prix max')}</label>
              <input id="f-max" inputMode="numeric" value={maxPrice} onChange={e => setMaxPrice(e.target.value.replace(/\D/g, ''))} placeholder="∞" className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" />
            </div>
            <div>
              <label htmlFor="f-moq" className="mb-1 block text-xs font-semibold text-muted-foreground">{tr('MOQ max')}</label>
              <input id="f-moq" inputMode="numeric" value={maxMoq} onChange={e => setMaxMoq(e.target.value.replace(/\D/g, ''))} placeholder="∞" className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} className="h-4 w-4 accent-[#F05A28]" />
            {tr('Fournisseurs vérifiés seulement')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} className="h-4 w-4 accent-[#F05A28]" />
            {tr('En stock seulement')}
          </label>
          {activeFilters > 0 && (
            <button type="button" onClick={resetFilters} className="text-xs font-bold text-primary">{tr('Réinitialiser les filtres')}</button>
          )}
        </div>
      )}

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
              {tr(cat)}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-primary/60" />
            <p className="text-sm text-muted-foreground">{tr('Chargement…')}</p>
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

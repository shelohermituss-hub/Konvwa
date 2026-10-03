import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useWishlist } from '@/lib/wishlist-context'
import { ProductCard } from '@/components/shared/product-card'
import { CATALOG_LIST_SELECT, localizeProduct, type CatalogProduct } from '@/lib/catalog'
import { tr } from '@/lib/i18n'

export function WishlistPage() {
  const navigate = useNavigate()
  const { ids } = useWishlist()
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const list = [...ids]
    if (list.length === 0) { setProducts([]); setLoading(false); return }
    let cancelled = false
    void supabase.from('products').select(CATALOG_LIST_SELECT).eq('active', true).in('id', list).then(({ data }) => {
      if (cancelled) return
      setProducts(((data ?? []) as unknown as CatalogProduct[]).map(localizeProduct))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [ids])

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      <div className="flex items-center gap-2 px-3 pt-4 pb-2">
        <button onClick={() => navigate(-1)} aria-label={tr('Retour')} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{tr('Mes favoris')}</h1>
          <p className="text-xs text-muted-foreground">{tr('Les produits que vous avez gardés de côté.')}</p>
        </div>
      </div>
      <div className="px-4 pb-8">
        {loading ? (
          <div className="columns-2 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="mb-3 h-48 animate-pulse rounded-2xl bg-white" />)}</div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <Heart className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-bold">{tr('Aucun favori pour le moment')}</p>
            <p className="max-w-[240px] text-xs text-muted-foreground">{tr('Touchez le cœur sur un produit pour le retrouver ici.')}</p>
            <button onClick={() => navigate('/products')} className="mt-2 rounded-full bg-primary px-5 py-2 text-xs font-bold text-white">{tr('Voir les produits')}</button>
          </div>
        ) : (
          <div className="columns-2 gap-3">
            {products.map((p) => <ProductCard key={p.id} product={p} onPress={() => navigate(`/products/${p.id}`)} />)}
          </div>
        )}
      </div>
    </div>
  )
}

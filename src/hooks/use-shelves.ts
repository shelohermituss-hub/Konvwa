import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CATALOG_CARD_SELECT, localizeProduct, resellerPriced, type CatalogProduct } from '@/lib/catalog'
import { buildShelves, type Shelf } from '@/lib/shelves'

// kept for the whole visit: coming back to the Accueil does not download the catalogue again
let cache: CatalogProduct[] | null = null

/** The themed rows of the Accueil (deals, favourites, electronics…), built from the retail catalogue. */
export function useShelves(enabled: boolean, isReseller: boolean): Shelf[] {
  const [items, setItems] = useState<CatalogProduct[]>(cache ?? [])
  useEffect(() => {
    if (!enabled || cache) return
    let live = true
    void supabase
      .from('products')
      .select(CATALOG_CARD_SELECT)
      .eq('active', true)
      .eq('product_variants.active', true)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!live || !data) return
        cache = (data as unknown as CatalogProduct[]).map(localizeProduct)
        setItems(cache)
      })
    return () => { live = false }
  }, [enabled])
  return useMemo(
    () => buildShelves(items.filter((p) => (p.sale_type ?? 'retail') === 'retail').map((p) => resellerPriced(p, isReseller))),
    [items, isReseller],
  )
}

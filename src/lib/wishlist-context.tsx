import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { tr } from '@/lib/i18n'

interface WishlistValue {
  ids: Set<string>
  has: (productId: string) => boolean
  toggle: (productId: string) => Promise<void>
}

const WishlistContext = createContext<WishlistValue>({ ids: new Set(), has: () => false, toggle: async () => {} })
export const useWishlist = () => useContext(WishlistContext)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [ids, setIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) { setIds(new Set()); return }
    let cancelled = false
    void supabase.from('wishlist_items').select('product_id').then(({ data }) => {
      if (!cancelled) setIds(new Set((data ?? []).map((r) => r.product_id as string)))
    })
    return () => { cancelled = true }
  }, [user])

  const toggle = useCallback(async (productId: string) => {
    if (!user) return
    const adding = !ids.has(productId)
    // optimistic update, rolled back if the database refuses
    setIds((prev) => { const n = new Set(prev); if (adding) n.add(productId); else n.delete(productId); return n })
    const { error } = adding
      ? await supabase.from('wishlist_items').insert({ user_id: user.id, product_id: productId })
      : await supabase.from('wishlist_items').delete().eq('user_id', user.id).eq('product_id', productId)
    if (error) {
      setIds((prev) => { const n = new Set(prev); if (adding) n.delete(productId); else n.add(productId); return n })
      toast.error(tr('Action impossible.'))
    }
  }, [user, ids])

  const value = useMemo<WishlistValue>(() => ({ ids, has: (id) => ids.has(id), toggle }), [ids, toggle])
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

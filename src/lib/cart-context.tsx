import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { LANG } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { effectiveUnitPrice } from '@/lib/product-pricing'
import { resellerPriced, variantLabel, VARIANT_SELECT, type ProductVariant } from '@/lib/catalog'

export interface CartItem {
  id: string
  product_id: string
  variant_id: string | null
  quantity: number
  product_variants: ProductVariant | null
  products: {
    id: string
    name: string
    price_htg: number
    price_tiers: unknown
    reseller_price?: boolean
    reseller_discount_pct?: number
    images: string[]
    unit: string
    moq: number
    stock_available: boolean
    supplier_country?: string | null
  }
}

interface CartContextType {
  items: CartItem[]
  count: number
  total: number
  loading: boolean
  addItem: (productId: string, quantity: number, variantId?: string | null) => Promise<void>
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>
  removeItem: (cartItemId: string) => Promise<void>
  clearCart: () => Promise<void>
  refresh: () => Promise<void>
}

/** Unit price shown for a cart line (the order itself is priced by the database). */
export function cartLineUnitPrice(item: CartItem): number {
  if (!item.products) return 0
  // the average price of one unit of the line: supplier offers ("2 for $48") count by full packs, the other units at the regular price
  return effectiveUnitPrice(item.products, item.quantity, item.product_variants)
}

export const CART_PRODUCT_SELECT = 'id, name, name_en, reseller_discount_pct, price_htg, price_tiers, images, unit, moq, stock_available, supplier_country'

/** A product row as read for the cart/checkout: localized name and reseller prices applied (display only). */
export function toCartProduct(p: CartItem['products'] & { name_en?: string | null }, isReseller: boolean): CartItem['products'] {
  return resellerPriced({ ...p, name: LANG === 'en' && p.name_en?.trim() ? p.name_en : p.name }, isReseller)
}

/** Name of the chosen variant, in the current language (empty when the line has none). */
export function cartLineVariantName(item: CartItem): string {
  const v = item.product_variants
  if (!v) return ''
  return v.group_name?.trim() ? `${v.group_name} : ${variantLabel(v)}` : variantLabel(v)
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const isReseller = !!profile?.is_reseller
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('cart_items')
      .select(`id, product_id, variant_id, quantity, product_variants(${VARIANT_SELECT}), products(id, name, name_en, reseller_discount_pct, price_htg, price_tiers, images, unit, moq, stock_available, supplier_country)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (data) {
      setItems((data as unknown as Array<CartItem & { products: (CartItem['products'] & { name_en?: string | null }) | null }>).map((i) => (
        i.products ? { ...i, products: toCartProduct(i.products, isReseller) } : i
      )) as CartItem[])
    }
    setLoading(false)
  }, [user, isReseller])

  useEffect(() => { refresh() }, [refresh])

  // One line per (product, variant): look the line up first, then update or insert it.
  async function addItem(productId: string, quantity: number, variantId?: string | null) {
    if (!user) return
    let find = supabase.from('cart_items').select('id').eq('user_id', user.id).eq('product_id', productId)
    find = variantId ? find.eq('variant_id', variantId) : find.is('variant_id', null)
    const { data: existing } = await find.maybeSingle()
    if (existing) await supabase.from('cart_items').update({ quantity }).eq('id', existing.id)
    else await supabase.from('cart_items').insert({ user_id: user.id, product_id: productId, variant_id: variantId ?? null, quantity })
    await refresh()
  }

  async function updateQuantity(cartItemId: string, quantity: number) {
    if (quantity <= 0) { await removeItem(cartItemId); return }
    await supabase.from('cart_items').update({ quantity }).eq('id', cartItemId)
    await refresh()
  }

  async function removeItem(cartItemId: string) {
    await supabase.from('cart_items').delete().eq('id', cartItemId)
    await refresh()
  }

  async function clearCart() {
    if (!user) return
    await supabase.from('cart_items').delete().eq('user_id', user.id)
    setItems([])
  }

  const count = items.reduce((sum, i) => sum + i.quantity, 0)
  const total = items.reduce((sum, i) => sum + i.quantity * cartLineUnitPrice(i), 0)

  return (
    <CartContext.Provider value={{ items, count, total, loading, addItem, updateQuantity, removeItem, clearCart, refresh }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { LANG } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { effectiveUnitPrice } from '@/lib/product-pricing'
import { fetchCartOptions, optionLabel, groupName, type CartOption } from '@/lib/product-options'
import { resellerPriced, variantLabel, VARIANT_SELECT, type ProductVariant } from '@/lib/catalog'

export interface CartItem {
  id: string
  product_id: string
  variant_id: string | null
  option_ids: string[]
  /** The chosen options with their group (filled by refresh). */
  options: CartOption[]
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
  addItem: (productId: string, quantity: number, variantId?: string | null, optionIds?: string[]) => Promise<void>
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>
  removeItem: (cartItemId: string) => Promise<void>
  clearCart: () => Promise<void>
  refresh: () => Promise<void>
}

/** Unit price shown for a cart line (the order itself is priced by the database). */
export function cartLineUnitPrice(item: CartItem, productQuantity: number = item.quantity): number {
  if (!item.products) return 0
  // the average price of one unit of the line: supplier offers ("2 for $48") count by full packs, the other units at the regular price;
  // the quantity tiers follow the product's total quantity in the cart (all its variants together)
  return effectiveUnitPrice(item.products, item.quantity, item.product_variants, productQuantity) + cartLineSupplement(item)
}

/** Total quantity of each product in the cart (all its variants / option choices together). */
export function productQuantities(items: CartItem[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const i of items) totals.set(i.product_id, (totals.get(i.product_id) ?? 0) + i.quantity)
  return totals
}

/** Products whose total quantity is below their minimum order quantity (the minimum counts all variants together). */
export function moqShortfalls(items: CartItem[]): Array<{ product_id: string; name: string; moq: number; have: number; unit: string }> {
  const totals = productQuantities(items)
  const seen = new Set<string>()
  const out: Array<{ product_id: string; name: string; moq: number; have: number; unit: string }> = []
  for (const i of items) {
    if (seen.has(i.product_id) || !i.products) continue
    seen.add(i.product_id)
    const have = totals.get(i.product_id) ?? 0
    if (have < i.products.moq) out.push({ product_id: i.product_id, name: i.products.name, moq: i.products.moq, have, unit: i.products.unit })
  }
  return out
}

/** Supplement per unit of the options chosen on a line. */
export function cartLineSupplement(item: CartItem): number {
  return item.options.reduce((s, o) => s + o.price_htg, 0)
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

/** Variant and options of a line as one text ("Couleur : Noir · Verres : Anti-bleu"). */
export function cartLineChoices(item: CartItem): string {
  return [cartLineVariantName(item), ...item.options.map((o) => `${groupName({ name: o.group_name, name_en: o.group_name_en })} : ${optionLabel(o)}`)].filter(Boolean).join(' · ')
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
      .select(`id, product_id, variant_id, option_ids, quantity, product_variants(${VARIANT_SELECT}), products(id, name, name_en, reseller_discount_pct, price_htg, price_tiers, images, unit, moq, stock_available, supplier_country)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (data) {
      const rows = data as unknown as Array<Omit<CartItem, 'options'> & { products: (CartItem['products'] & { name_en?: string | null }) | null }>
      const ids = [...new Set(rows.flatMap((i) => i.option_ids ?? []))]
      const known = await fetchCartOptions(ids)
      setItems(rows.map((i) => ({
        ...i, option_ids: i.option_ids ?? [], options: (i.option_ids ?? []).map((id) => known.get(id)).filter((o): o is CartOption => !!o),
        ...(i.products ? { products: toCartProduct(i.products, isReseller) } : {}),
      })) as CartItem[])
    }
    setLoading(false)
  }, [user, isReseller])

  useEffect(() => { refresh() }, [refresh])

  // One line per (product, variant, options): look the line up first, then update or insert it.
  async function addItem(productId: string, quantity: number, variantId?: string | null, optionIds: string[] = []) {
    if (!user) return
    const options = [...optionIds].sort()
    let find = supabase.from('cart_items').select('id').eq('user_id', user.id).eq('product_id', productId).eq('option_ids', `{${options.join(',')}}`)
    find = variantId ? find.eq('variant_id', variantId) : find.is('variant_id', null)
    const { data: existing } = await find.maybeSingle()
    if (existing) await supabase.from('cart_items').update({ quantity }).eq('id', existing.id)
    else await supabase.from('cart_items').insert({ user_id: user.id, product_id: productId, variant_id: variantId ?? null, option_ids: options, quantity })
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
  const totals = productQuantities(items)
  const total = items.reduce((sum, i) => sum + i.quantity * cartLineUnitPrice(i, totals.get(i.product_id)), 0)

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

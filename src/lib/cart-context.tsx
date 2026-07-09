import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export interface CartItem {
  id: string
  product_id: string
  quantity: number
  products: {
    id: string
    name: string
    price_htg: number
    images: string[]
    unit: string
    moq: number
    stock_available: boolean
  }
}

interface CartContextType {
  items: CartItem[]
  count: number
  total: number
  loading: boolean
  addItem: (productId: string, quantity: number) => Promise<void>
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>
  removeItem: (cartItemId: string) => Promise<void>
  clearCart: () => Promise<void>
  refresh: () => Promise<void>
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('cart_items')
      .select('id, product_id, quantity, products(id, name, price_htg, images, unit, moq, stock_available)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (data) setItems(data as unknown as CartItem[])
    setLoading(false)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  async function addItem(productId: string, quantity: number) {
    if (!user) return
    await supabase.from('cart_items').upsert(
      { user_id: user.id, product_id: productId, quantity },
      { onConflict: 'user_id,product_id' }
    )
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
  const total = items.reduce((sum, i) => sum + i.quantity * (i.products?.price_htg ?? 0), 0)

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

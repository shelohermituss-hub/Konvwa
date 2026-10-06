import { supabase } from '@/lib/supabase'
import { tr } from '@/lib/i18n'

export interface CheckoutShippingOption {
  rate_id: string
  name: string
  mode: string
  transit_days_min: number | null
  transit_days_max: number | null
  amount_htg: number
}

export interface CheckoutShipping {
  /** Number of cart lines shipped from the USA (sold all inclusive). */
  us_count: number
  other_count: number
  /** US products whose package (weight, dimensions) is not filled in: they cannot be ordered yet. */
  missing: Array<{ product_id: string; name: string }>
  kg: number
  cbm: number
  options: CheckoutShippingOption[]
}

export interface CreatedOrder { order_id: string; total: number; shipping: number; prepaid: boolean }

interface CartLine { product_id: string; variant_id?: string | null; quantity: number }

/** Shipping methods (and prices, computed by the database) for the US part of the cart. */
export async function fetchCheckoutShipping(items: CartLine[]): Promise<CheckoutShipping> {
  const { data, error } = await supabase.rpc('checkout_shipping_options', { p_items: items })
  if (error) throw new Error(error.message)
  if (!data?.success) throw new Error(data?.error ?? tr('Erreur inconnue'))
  return {
    us_count: data.us_count ?? 0, other_count: data.other_count ?? 0, missing: data.missing ?? [],
    kg: data.kg ?? 0, cbm: data.cbm ?? 0, options: data.options ?? [],
  }
}

/** Creates the order(s): US products all inclusive with the chosen method, the rest purchase only. */
export async function createCheckout(items: CartLine[], rateId: string | null): Promise<{ orders: CreatedOrder[]; total: number }> {
  const { data, error } = await supabase.rpc('create_product_checkout', { p_items: items, p_shipping_rate_id: rateId })
  if (error) throw new Error(error.message)
  if (!data?.success) throw new Error(data?.error ?? tr('Erreur création commande'))
  return { orders: data.orders as CreatedOrder[], total: Number(data.total) }
}

import { supabase } from './supabase'

import { tr } from '@/lib/i18n'
export interface CreatePaymentResult {
  url: string
  reference_id: string
  transaction_id: string
}

export interface VerifyPaymentResult {
  /** 'checkout' for a payment made at the checkout, 'topup' for a wallet recharge. */
  kind?: 'checkout' | 'topup'
  /** The gateway confirmed the payment. */
  verified: boolean
  amount?: number
  method?: string
  status?: string
  failed?: boolean
  already_processed?: boolean
  /** Checkout only: the orders were placed (false = paid but not ordered, the money is in the wallet). */
  ok?: boolean
  orders?: Array<{ order_id: string; total: number }>
  total?: number
  credited?: number
  error?: string
  /** Checkout only: 'cart' payments empty the cart once ordered. */
  source?: 'cart' | 'buy_now'
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    // a non-2xx answer carries the function's own message in the response body
    const ctx = (error as { context?: Response }).context
    const detail = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) as { error?: string } | null : null
    throw new Error(detail?.error || error.message || tr('Erreur réseau'))
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

export async function createPayment(args: {
  amount: number
  method: 'moncash' | 'natcash' | 'stripe'
  wallet_id: string
}): Promise<CreatePaymentResult> {
  // card payments go through Stripe Checkout (its own Edge Function), mobile money through the PLOP PLOP gateway
  if (args.method === 'stripe') return invoke('stripe-checkout', { kind: 'topup', amount: args.amount })
  return invoke('payment-create', args)
}

/** References of card payments start with KWS- (MonCash / NatCash ones with KW-). */
const isCardRef = (ref: string) => ref.startsWith('KWS-')

/** Pay a cart (or one product) with MonCash / NatCash: nothing is ordered until the gateway confirms the payment. */
export async function createCheckoutPayment(args: {
  method: 'moncash' | 'natcash' | 'stripe'
  items: Array<{ product_id: string; variant_id: string | null; quantity: number }>
  shipping_rate_id: string | null
  source: 'cart' | 'buy_now'
}): Promise<CreatePaymentResult> {
  return invoke(args.method === 'stripe' ? 'stripe-checkout' : 'payment-create', { kind: 'checkout', ...args })
}

export async function verifyPayment(reference_id: string): Promise<VerifyPaymentResult> {
  if (isCardRef(reference_id)) return invoke('stripe-checkout', { action: 'verify', reference: reference_id })
  return invoke('payment-verify', { reference_id })
}

export async function withdrawPayment(args: {
  amount: number
  method: 'moncash' | 'natcash'
  recipient: string
  reference: string
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  return invoke('payment-withdraw', args)
}

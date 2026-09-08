import { supabase } from './supabase'

export interface CreatePaymentResult {
  url: string
  reference_id: string
  transaction_id: string
}

export interface VerifyPaymentResult {
  verified: boolean
  amount?: number
  method?: string
  status?: string
  failed?: boolean
  already_processed?: boolean
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) throw new Error(error.message || 'Erreur réseau')
  if (data?.error) throw new Error(data.error)
  return data as T
}

export async function createPayment(args: {
  amount: number
  method: 'moncash' | 'natcash'
  wallet_id: string
}): Promise<CreatePaymentResult> {
  return invoke('payment-create', args)
}

export async function verifyPayment(reference_id: string): Promise<VerifyPaymentResult> {
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

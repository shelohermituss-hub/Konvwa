import { tr } from '@/lib/i18n'

/**
 * Catalogue orders are "purchase only" orders. When the parcel arrives, the team opens a normal shipping request for it
 * (same flow as any shipping request: real CBM / kg, rate grid, quote, payment, invoice, batch).
 */

export type ProductOrderStage =
  | 'pending' | 'purchasing' | 'awaiting_quote' | 'quote_ready' | 'deposit_paid' | 'shipping_paid' | 'shipped' | 'delivered' | 'cancelled'

export interface ShippingRequestState {
  status: string
  quoted_amount_htg?: number | null
  paid_amount_htg?: number | null
  payment_due_at?: string | null
}

export interface ProductOrderState {
  status: string
  payment_status: string
  shipping_request: ShippingRequestState | null
}

export function productOrderStage(o: ProductOrderState): ProductOrderStage {
  if (o.status === 'cancelled' || o.payment_status === 'refunded') return 'cancelled'
  if (o.status === 'delivered') return 'delivered'
  if (o.status === 'shipped') return 'shipped'
  if (o.payment_status !== 'paid') return 'pending'
  const req = o.shipping_request
  if (!req) return 'purchasing'
  switch (req.status) {
    case 'quoted': return 'quote_ready'
    case 'deposit_paid': return 'deposit_paid'
    case 'invoiced': return 'shipping_paid'
    case 'cancelled': return 'purchasing'
    default: return 'awaiting_quote'  // submitted, reviewing, received
  }
}

/** Position on the 5-step tracker (0 = purchase paid … 4 = delivered); -1 when not started or cancelled. */
export function productOrderStep(stage: ProductOrderStage): number {
  switch (stage) {
    case 'purchasing': return 0
    case 'awaiting_quote': return 1
    case 'quote_ready':
    case 'deposit_paid': return 2
    case 'shipping_paid':
    case 'shipped': return 3
    case 'delivered': return 4
    default: return -1
  }
}

/** True when the customer has a shipping quote to pay. */
export function needsShippingPayment(o: ProductOrderState): boolean {
  return productOrderStage(o) === 'quote_ready'
}

const LABELS: Record<ProductOrderStage, () => string> = {
  pending: () => tr('En attente de paiement'),
  purchasing: () => tr('Achat en cours'),
  awaiting_quote: () => tr('Colis arrivé : devis d\'expédition en préparation'),
  quote_ready: () => tr('Devis d\'expédition à payer'),
  deposit_paid: () => tr('Expédition : acompte payé'),
  shipping_paid: () => tr('Expédition payée'),
  shipped: () => tr('Expédié vers Haïti'),
  delivered: () => tr('Livré'),
  cancelled: () => tr('Annulée'),
}

export function productOrderStageLabel(stage: ProductOrderStage): string {
  return LABELS[stage]()
}

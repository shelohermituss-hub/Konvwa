import { tr } from '@/lib/i18n'

/** Catalogue orders: purchase only, then the customer pays the shipping once the parcel arrived at the warehouse. */

export type ProductOrderStage = 'pending' | 'purchasing' | 'arrived' | 'ready_to_ship' | 'shipped' | 'delivered' | 'cancelled'

export interface ProductOrderState {
  status: string
  payment_status: string
  received_at: string | null
  shipping_paid_at: string | null
}

export function productOrderStage(o: ProductOrderState): ProductOrderStage {
  if (o.status === 'cancelled' || o.payment_status === 'refunded') return 'cancelled'
  if (o.status === 'delivered') return 'delivered'
  if (o.status === 'shipped') return 'shipped'
  if (o.payment_status !== 'paid') return 'pending'
  if (!o.received_at) return 'purchasing'
  if (!o.shipping_paid_at) return 'arrived'
  return 'ready_to_ship'
}

/** Position on the 5-step tracker (0 = purchase paid … 4 = delivered); -1 when not started or cancelled. */
export function productOrderStep(stage: ProductOrderStage): number {
  switch (stage) {
    case 'purchasing': return 0
    case 'arrived': return 1
    case 'ready_to_ship': return 2
    case 'shipped': return 3
    case 'delivered': return 4
    default: return -1
  }
}

/** True when the customer owes the shipping. */
export function needsShippingPayment(o: ProductOrderState & { shipping_amount_htg: number | null }): boolean {
  return productOrderStage(o) === 'arrived' && (o.shipping_amount_htg ?? 0) > 0
}

const LABELS: Record<ProductOrderStage, () => string> = {
  pending: () => tr('En attente de paiement'),
  purchasing: () => tr('Achat en cours'),
  arrived: () => tr('Colis arrivé : expédition à payer'),
  ready_to_ship: () => tr('Expédition payée'),
  shipped: () => tr('Expédié vers Haïti'),
  delivered: () => tr('Livré'),
  cancelled: () => tr('Annulée'),
}

export function productOrderStageLabel(stage: ProductOrderStage): string {
  return LABELS[stage]()
}

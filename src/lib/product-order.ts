import { TIMELINE_ICONS, type TimelineItem } from '@/components/shared/timeline-step'
import { cargoActiveIndex, cargoStatusLabel, cargoSteps } from '@/lib/cargo-tracking'
import { tr } from '@/lib/i18n'

/**
 * A catalogue order is a "purchase only" order. The customer pays the purchase; when the team says the parcel is available at
 * the warehouse, a normal shipping request is opened for it and follows the usual cargo flow (quote, payment, batch, transit,
 * customs, delivery). The tracking below is the same as a shipping request, preceded by the paid purchase.
 */

export type ProductOrderStage =
  | 'pending' | 'purchasing' | 'awaiting_quote' | 'quote_ready' | 'deposit_paid' | 'shipping_paid' | 'shipped' | 'delivered' | 'cancelled'

export interface ShippingRequestState {
  status: string
  quoted_amount_htg?: number | null
  paid_amount_htg?: number | null
  payment_due_at?: string | null
  payment_plan?: string | null
  shipment?: { status: string } | null
}

export interface ProductOrderState {
  status: string
  payment_status: string
  shipping_request: ShippingRequestState | null
}

const IN_TRANSIT = ['shipped', 'in_transit', 'arrived_haiti', 'customs_processing', 'out_for_delivery']

export function productOrderStage(o: ProductOrderState): ProductOrderStage {
  if (o.status === 'cancelled' || o.payment_status === 'refunded') return 'cancelled'
  if (o.status === 'delivered') return 'delivered'
  if (o.payment_status !== 'paid') return 'pending'
  const req = o.shipping_request
  if (!req) return 'purchasing'
  switch (req.status) {
    case 'quoted': return 'quote_ready'
    case 'deposit_paid':
    case 'invoiced': {
      const batch = req.shipment?.status
      if (batch === 'delivered') return 'delivered'
      if ((batch && IN_TRANSIT.includes(batch)) || o.status === 'shipped') return 'shipped'
      return req.status === 'invoiced' ? 'shipping_paid' : 'deposit_paid'
    }
    case 'cancelled': return 'purchasing'
    default: return 'awaiting_quote'  // submitted, reviewing, received
  }
}

/** True when the customer has a shipping quote to pay. */
export function needsShippingPayment(o: ProductOrderState): boolean {
  return productOrderStage(o) === 'quote_ready'
}

const LABELS: Record<ProductOrderStage, () => string> = {
  pending: () => tr('En attente de paiement'),
  purchasing: () => tr('Achat en cours'),
  awaiting_quote: () => tr('Disponible à l\'entrepôt : devis d\'expédition en préparation'),
  quote_ready: () => tr('Devis d\'expédition à payer'),
  deposit_paid: () => tr('Expédition : acompte payé'),
  shipping_paid: () => tr('Expédition payée'),
  shipped: () => tr('Expédié vers Haïti'),
  delivered: () => tr('Livré'),
  cancelled: () => tr('Annulée'),
}

/** Badge text: the stage, or the cargo status (in transit, in customs…) once the shipping is paid. */
export function productOrderLabel(o: ProductOrderState): string {
  const stage = productOrderStage(o)
  if ((stage === 'shipped' || stage === 'delivered') && o.shipping_request?.shipment) {
    return cargoStatusLabel({ status: o.shipping_request.status, payment_plan: o.shipping_request.payment_plan, shipment: o.shipping_request.shipment })
  }
  return LABELS[stage]()
}

const PURCHASED: TimelineItem = {
  key: 'purchased', label: tr('Achat payé'), description: tr('Achat des produits payé'), icon: TIMELINE_ICONS.paye,
}

/** The same steps as a shipping request (warehouse, quote, payment, transit…), preceded by the paid purchase. */
export function productOrderTimeline(o: ProductOrderState): { steps: TimelineItem[]; index: number } {
  const req = o.shipping_request
  const cargo = { status: req?.status ?? 'received', payment_plan: req?.payment_plan, shipment: req?.shipment }
  const steps = [PURCHASED, ...cargoSteps(cargo).slice(2)]
  if (productOrderStage(o) === 'delivered') return { steps, index: steps.length - 1 }
  if (!req || req.status === 'cancelled') return { steps, index: 0 }
  const i = cargoActiveIndex(cargo)
  return { steps, index: i < 2 ? 1 : i - 1 }
}

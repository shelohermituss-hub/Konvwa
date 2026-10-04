import { tr } from '@/lib/i18n'

/**
 * A catalogue order is a "purchase only" order that is already paid: its tracking is the normal order tracking, starting at "Payé".
 * When the team says the parcel is available at the warehouse (real weight / volume entered), the customer picks a shipping
 * method (fees computed by the database) and pays. Paying creates a paid shipping request linked to the order; the team then
 * moves the cargo status and the order follows.
 */

export interface ProductOrderState {
  status: string
  payment_status: string
  tracking_status: string | null
  shipping_paid_at?: string | null
}

export const IN_TRANSIT = ['shipped', 'in_transit', 'arrived_haiti', 'customs_processing', 'out_for_delivery']

/** Tracking status shown on the shared order timeline (a paid order that has no tracking yet is at "paid"). */
export function trackingStatusOf(o: ProductOrderState): string {
  return o.tracking_status ?? 'paid'
}

export function isCancelledOrder(o: ProductOrderState): boolean {
  return o.status === 'cancelled' || o.payment_status === 'refunded'
}

/** True when the parcel is at the warehouse and the customer has to choose a shipping method and pay. */
export function needsShippingPayment(o: ProductOrderState): boolean {
  return o.payment_status === 'paid' && !isCancelledOrder(o) && o.tracking_status === 'in_china_warehouse' && !o.shipping_paid_at
}

const TRACKING_LABEL: Record<string, () => string> = {
  paid: () => tr('Payé'),
  purchasing: () => tr('Achat en cours'),
  in_china_warehouse: () => tr('Disponible à l\'entrepôt'),
  shipped: () => tr('Expédié vers Haïti'),
  in_transit: () => tr('En transit'),
  arrived_haiti: () => tr('Arrivé en Haïti'),
  customs_processing: () => tr('Dédouanement'),
  out_for_delivery: () => tr('En livraison'),
  delivered: () => tr('Livré'),
}

/** Badge text. */
export function productOrderLabel(o: ProductOrderState): string {
  if (isCancelledOrder(o)) return tr('Annulée')
  if (o.payment_status !== 'paid') return tr('En attente de paiement')
  if (needsShippingPayment(o)) return tr('Choisissez l\'expédition et payez')
  const t = trackingStatusOf(o)
  if (t === 'in_china_warehouse') return tr('Expédition payée — départ en préparation')
  return (TRACKING_LABEL[t] ?? (() => t))()
}

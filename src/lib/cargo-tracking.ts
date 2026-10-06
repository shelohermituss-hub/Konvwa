import { TIMELINE_ICONS, type TimelineItem } from '@/components/shared/timeline-step'

import { tr } from '@/lib/i18n'
// Cargo requests use the order-tracking vocabulary once they are paid and assigned to a batch.
const PRE_PAYMENT: TimelineItem[] = [
  { key: 'submitted', label: tr('Demande'),   description: tr('Demande d\'expédition soumise'),     icon: TIMELINE_ICONS.creation },
  { key: 'reviewing', label: tr('Examen'),    description: tr('Demande en cours d\'examen'),        icon: TIMELINE_ICONS.acceptation },
  { key: 'received',  label: tr('Entrepôt'),  description: tr('Colis reçus à l\'entrepôt'),         icon: TIMELINE_ICONS.entrepot },
  { key: 'quoted',    label: tr('Devis'),     description: tr('Devis officiel envoyé'),             icon: TIMELINE_ICONS.devis },
]

const POST_PAYMENT: TimelineItem[] = [
  { key: 'shipped',            label: tr('Expédition'), description: tr('Expédié vers Haïti'),          icon: TIMELINE_ICONS.navire },
  { key: 'in_transit',         label: tr('Transit'),    description: tr('En transit maritime'),         icon: TIMELINE_ICONS.navire },
  { key: 'arrived_haiti',      label: tr('Arrivée'),    description: tr('Arrivé en Haïti'),             icon: TIMELINE_ICONS.arrivee },
  { key: 'customs_processing', label: tr('Douane'),     description: tr('Dédouanement en cours'),       icon: TIMELINE_ICONS.douane },
  { key: 'out_for_delivery',   label: tr('Livraison'),  description: tr('En cours de livraison'),       icon: TIMELINE_ICONS.livraison },
  { key: 'delivered',          label: tr('Terminé'),    description: tr('Cargaison livrée'),            icon: TIMELINE_ICONS.livre },
]

export interface CargoForEstimate {
  status: string
  tracking_status?: string | null
  shipment?: { status: string; departure_date?: string | null; estimated_arrival?: string | null } | null
  quoted_rate?: { transit_days_min: number | null; transit_days_max: number | null } | null
}

export type CargoEstimate =
  | { kind: 'date'; date: Date }
  | { kind: 'days'; min: number; max: number }
  | null

const DAY = 86_400_000
const DONE = new Set(['arrived_haiti', 'customs_processing', 'out_for_delivery', 'delivered'])

/**
 * When the cargo should reach Haiti: the batch's estimated arrival when known; otherwise the transit time of the shipping method
 * (counted from the batch departure when there is one). Nothing once it has arrived, or before a method / batch is known.
 */
export function cargoEstimate(req: CargoForEstimate): CargoEstimate {
  if (!['quoted', 'deposit_paid', 'invoiced'].includes(req.status)) return null
  const track = req.tracking_status ?? req.shipment?.status
  if (track && DONE.has(track)) return null
  const eta = req.shipment?.estimated_arrival ? new Date(req.shipment.estimated_arrival) : null
  if (eta && !Number.isNaN(eta.getTime())) return { kind: 'date', date: eta }
  const min = req.quoted_rate?.transit_days_min ?? null
  const max = req.quoted_rate?.transit_days_max ?? min
  if (min == null || max == null) return null
  const dep = req.shipment?.departure_date ? new Date(req.shipment.departure_date) : null
  if (dep && !Number.isNaN(dep.getTime())) {
    const from = new Date(dep.getTime() + min * DAY)
    const to = new Date(dep.getTime() + max * DAY)
    return { kind: 'date', date: to.getTime() === from.getTime() ? from : to }
  }
  return { kind: 'days', min, max }
}

export interface CargoForTracking {
  status: string
  payment_plan?: string | null
  /** Cargo status set by the team once paid (also driven by the batch); wins over the batch status. */
  tracking_status?: string | null
  shipment?: { status: string } | null
}

const trackOf = (req: CargoForTracking) => req.tracking_status ?? req.shipment?.status

function paymentStep(req: CargoForTracking): TimelineItem {
  const half = req.status === 'deposit_paid' || req.payment_plan === 'half'
  return half
    ? { key: 'paid', label: tr('Acompte payé'), description: tr('Solde à régler à la livraison'), icon: TIMELINE_ICONS.paye }
    : { key: 'paid', label: tr('Payé'),         description: tr('Paiement confirmé'),            icon: TIMELINE_ICONS.paye }
}

export function cargoSteps(req: CargoForTracking): TimelineItem[] {
  return [...PRE_PAYMENT, paymentStep(req), ...POST_PAYMENT]
}

export function cargoActiveIndex(req: CargoForTracking): number {
  const early = PRE_PAYMENT.findIndex(s => s.key === req.status)
  if (early !== -1) return early
  if (req.status !== 'invoiced' && req.status !== 'deposit_paid') return -1

  const paidIdx = PRE_PAYMENT.length
  const track = POST_PAYMENT.findIndex(s => s.key === trackOf(req))
  return track === -1 ? paidIdx : paidIdx + 1 + track
}

const EARLY_LABEL: Record<string, string> = {
  submitted: tr('Soumis'),
  reviewing: tr('En examen'),
  received: tr('Colis reçus'),
  quoted: tr('Devis reçu'),
  deposit_paid: tr('Acompte payé'),
  invoiced: tr('Payé'),
  cancelled: tr('Annulé'),
}

const TRACK_LABEL: Record<string, string> = {
  shipping_paid: tr('Expédition payée'),
  shipped: tr('Expédié'),
  in_transit: tr('En transit'),
  arrived_haiti: tr('Arrivé en Haïti'),
  customs_processing: tr('Dédouanement'),
  out_for_delivery: tr('En livraison'),
  delivered: tr('Livré'),
}

// Label shown on badges: the batch status once the cargo is paid and on its way
export function cargoStatusLabel(req: CargoForTracking): string {
  const track = trackOf(req)
  if ((req.status === 'invoiced' || req.status === 'deposit_paid') && track) {
    const tracked = TRACK_LABEL[track]
    if (tracked) return tracked
  }
  return EARLY_LABEL[req.status] ?? req.status
}

export function shipmentStatusLabel(status: string): string {
  return status === 'in_china_warehouse' ? tr('Entrepôt (Chine)') : (TRACK_LABEL[status] ?? status)
}

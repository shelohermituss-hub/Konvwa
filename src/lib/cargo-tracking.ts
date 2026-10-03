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

export interface CargoForTracking {
  status: string
  payment_plan?: string | null
  shipment?: { status: string } | null
}

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
  const track = POST_PAYMENT.findIndex(s => s.key === req.shipment?.status)
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
  shipped: tr('Expédié'),
  in_transit: tr('En transit'),
  arrived_haiti: tr('Arrivé en Haïti'),
  customs_processing: tr('Dédouanement'),
  out_for_delivery: tr('En livraison'),
  delivered: tr('Livré'),
}

// Label shown on badges: the batch status once the cargo is paid and on its way
export function cargoStatusLabel(req: CargoForTracking): string {
  if ((req.status === 'invoiced' || req.status === 'deposit_paid') && req.shipment) {
    const tracked = TRACK_LABEL[req.shipment.status]
    if (tracked) return tracked
  }
  return EARLY_LABEL[req.status] ?? req.status
}

export function shipmentStatusLabel(status: string): string {
  return status === 'in_china_warehouse' ? tr('Entrepôt (Chine)') : (TRACK_LABEL[status] ?? status)
}

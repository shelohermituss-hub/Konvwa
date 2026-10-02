import { TIMELINE_ICONS, type TimelineItem } from '@/components/shared/timeline-step'

// Cargo requests use the order-tracking vocabulary once they are paid and assigned to a batch.
const PRE_PAYMENT: TimelineItem[] = [
  { key: 'submitted', label: 'Demande',   description: 'Demande d\'expédition soumise',     icon: TIMELINE_ICONS.creation },
  { key: 'reviewing', label: 'Examen',    description: 'Demande en cours d\'examen',        icon: TIMELINE_ICONS.acceptation },
  { key: 'received',  label: 'Entrepôt',  description: 'Colis reçus à l\'entrepôt',         icon: TIMELINE_ICONS.entrepot },
  { key: 'quoted',    label: 'Devis',     description: 'Devis officiel envoyé',             icon: TIMELINE_ICONS.devis },
]

const POST_PAYMENT: TimelineItem[] = [
  { key: 'shipped',            label: 'Expédition', description: 'Expédié vers Haïti',          icon: TIMELINE_ICONS.navire },
  { key: 'in_transit',         label: 'Transit',    description: 'En transit maritime',         icon: TIMELINE_ICONS.navire },
  { key: 'arrived_haiti',      label: 'Arrivée',    description: 'Arrivé en Haïti',             icon: TIMELINE_ICONS.arrivee },
  { key: 'customs_processing', label: 'Douane',     description: 'Dédouanement en cours',       icon: TIMELINE_ICONS.douane },
  { key: 'out_for_delivery',   label: 'Livraison',  description: 'En cours de livraison',       icon: TIMELINE_ICONS.livraison },
  { key: 'delivered',          label: 'Terminé',    description: 'Cargaison livrée',            icon: TIMELINE_ICONS.livre },
]

export interface CargoForTracking {
  status: string
  payment_plan?: string | null
  shipment?: { status: string } | null
}

function paymentStep(req: CargoForTracking): TimelineItem {
  const half = req.status === 'deposit_paid' || req.payment_plan === 'half'
  return half
    ? { key: 'paid', label: 'Acompte payé', description: 'Solde à régler à la livraison', icon: TIMELINE_ICONS.paye }
    : { key: 'paid', label: 'Payé',         description: 'Paiement confirmé',            icon: TIMELINE_ICONS.paye }
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
  submitted: 'Soumis',
  reviewing: 'En examen',
  received: 'Colis reçus',
  quoted: 'Devis reçu',
  deposit_paid: 'Acompte payé',
  invoiced: 'Payé',
  cancelled: 'Annulé',
}

const TRACK_LABEL: Record<string, string> = {
  shipped: 'Expédié',
  in_transit: 'En transit',
  arrived_haiti: 'Arrivé en Haïti',
  customs_processing: 'Dédouanement',
  out_for_delivery: 'En livraison',
  delivered: 'Livré',
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
  return status === 'in_china_warehouse' ? 'Entrepôt (Chine)' : (TRACK_LABEL[status] ?? status)
}

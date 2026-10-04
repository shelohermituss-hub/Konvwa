import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { OrderStatus, ShipmentStatus, QuoteStatus, PaymentStatus, TicketStatus } from '@/types'

import { tr } from '@/lib/i18n'
const statusVariants = cva('', {
  variants: {
    variant: {
      default: '',
      draft: 'bg-muted text-muted-foreground',
      pending: 'bg-warning/10 text-warning border-warning/20',
      submitted: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      reviewing: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      quote_sent: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      quote_accepted: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      awaiting_payment: 'bg-warning/10 text-warning border-warning/20',
      paid: 'bg-success/10 text-success border-success/20',
      purchasing: 'bg-sky-50 text-sky-700 border-sky-100',
      in_china_warehouse: 'bg-sky-50 text-sky-700 border-sky-100',
      shipping_paid: 'bg-success/10 text-success border-success/20',
      shipped: 'bg-sky-50 text-sky-700 border-sky-100',
      in_transit: 'bg-sky-50 text-sky-700 border-sky-100',
      arrived_haiti: 'bg-sky-50 text-sky-700 border-sky-100',
      customs_processing: 'bg-warning/10 text-warning border-warning/20',
      out_for_delivery: 'bg-success/10 text-success border-success/20',
      delivered: 'bg-success/10 text-success border-success/20',
      closed: 'bg-muted text-muted-foreground',
      cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
      rejected: 'bg-destructive/10 text-destructive border-destructive/20',
      expired: 'bg-muted text-muted-foreground',
      accepted: 'bg-success/10 text-success border-success/20',
      unpaid: 'bg-muted text-muted-foreground',
      partial: 'bg-warning/10 text-warning border-warning/20',
      refunded: 'bg-muted text-muted-foreground',
      open: 'bg-warning/10 text-warning border-warning/20',
      in_progress: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      resolved: 'bg-success/10 text-success border-success/20',
      quoted: 'bg-success/10 text-success border-success/20',
      consolidating: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      packed: 'bg-sky-50 text-sky-700 border-sky-100',
      loaded: 'bg-sky-50 text-sky-700 border-sky-100',
      sailing: 'bg-sky-50 text-sky-700 border-sky-100',
      arrived: 'bg-success/10 text-success border-success/20',
      cleared: 'bg-success/10 text-success border-success/20',
      distributing: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      completed: 'bg-success/10 text-success border-success/20',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

type StatusVariant = VariantProps<typeof statusVariants>['variant']

const statusLabels: Record<string, string> = {
  draft: tr('Brouillon'),
  pending: tr('En attente'),
  submitted: tr('Soumis'),
  reviewing: tr('En révision'),
  quoted: tr('Devisé'),
  quote_sent: tr('Devis envoyé'),
  quote_accepted: tr('Devis accepté'),
  awaiting_payment: tr('En attente de paiement'),
  paid: tr('Payé'),
  purchasing: tr('Achat en cours'),
  in_china_warehouse: tr('En entrepôt (Chine)'),
  shipping_paid: tr('Expédition payée'),
  shipped: tr('Expédié'),
  in_transit: tr('En transit'),
  arrived_haiti: tr('Arrivé en Haïti'),
  customs_processing: tr('Dédouanement'),
  out_for_delivery: tr('En livraison'),
  delivered: tr('Livrée'),
  closed: tr('Clôturée'),
  cancelled: tr('Annulée'),
  rejected: tr('Rejeté'),
  expired: tr('Expiré'),
  accepted: tr('Accepté'),
  unpaid: tr('Non payé'),
  partial: tr('Partiel'),
  refunded: tr('Remboursé'),
  open: tr('Ouvert'),
  in_progress: tr('En cours'),
  resolved: tr('Résolu'),
  consolidating: tr('Consolidation'),
  packed: tr('Emballé'),
  loaded: tr('Chargé'),
  sailing: tr('En mer'),
  arrived: tr('Arrivé'),
  cleared: tr('Dédouané'),
  distributing: tr('Distribution'),
  completed: tr('Terminé'),
}

interface StatusBadgeProps {
  status: OrderStatus | ShipmentStatus | QuoteStatus | PaymentStatus | TicketStatus | string
  className?: string
}

const validVariants: StatusVariant[] = [
  'default', 'draft', 'pending', 'submitted', 'reviewing', 'quote_sent', 'quote_accepted',
  'awaiting_payment', 'paid', 'purchasing', 'in_china_warehouse', 'shipping_paid', 'shipped', 'in_transit',
  'arrived_haiti', 'customs_processing', 'out_for_delivery', 'delivered', 'closed', 'cancelled',
  'rejected', 'expired', 'accepted', 'unpaid', 'partial', 'refunded', 'open', 'in_progress',
  'resolved', 'quoted', 'consolidating', 'packed', 'loaded', 'sailing', 'arrived', 'cleared',
  'distributing', 'completed'
]

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = validVariants.includes(status as StatusVariant)
    ? (status as StatusVariant)
    : 'default'

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none', statusVariants({ variant }), className)}>
      {statusLabels[status] || status}
    </span>
  )
}

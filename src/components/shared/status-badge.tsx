import { Badge } from '@/components/ui/badge'
import { cva, type VariantProps } from 'class-variance-authority'
import type { OrderStatus, ShipmentStatus, QuoteStatus, PaymentStatus, TicketStatus } from '@/types'

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
  draft: 'Brouillon',
  pending: 'En attente',
  submitted: 'Soumis',
  reviewing: 'En révision',
  quoted: 'Devisé',
  quote_sent: 'Devis envoyé',
  quote_accepted: 'Devis accepté',
  awaiting_payment: 'En attente de paiement',
  paid: 'Payé',
  purchasing: 'Achat en cours',
  in_china_warehouse: 'En entrepôt (Chine)',
  shipped: 'Expédié',
  in_transit: 'En transit',
  arrived_haiti: 'Arrivé en Haïti',
  customs_processing: 'Dédouanement',
  out_for_delivery: 'En livraison',
  delivered: 'Livrée',
  closed: 'Clôturée',
  cancelled: 'Annulée',
  rejected: 'Rejeté',
  expired: 'Expiré',
  accepted: 'Accepté',
  unpaid: 'Non payé',
  partial: 'Partiel',
  refunded: 'Remboursé',
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
  consolidating: 'Consolidation',
  packed: 'Emballé',
  loaded: 'Chargé',
  sailing: 'En mer',
  arrived: 'Arrivé',
  cleared: 'Dédouané',
  distributing: 'Distribution',
  completed: 'Terminé',
}

interface StatusBadgeProps {
  status: OrderStatus | ShipmentStatus | QuoteStatus | PaymentStatus | TicketStatus | string
  className?: string
}

const validVariants: StatusVariant[] = [
  'default', 'draft', 'pending', 'submitted', 'reviewing', 'quote_sent', 'quote_accepted',
  'awaiting_payment', 'paid', 'purchasing', 'in_china_warehouse', 'shipped', 'in_transit',
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
    <Badge variant="outline" className={statusVariants({ variant, className })}>
      {statusLabels[status] || status}
    </Badge>
  )
}

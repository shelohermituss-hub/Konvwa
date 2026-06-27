import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types'

const ORDER_TIMELINE: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'draft', label: 'Création', description: 'Demande créée' },
  { status: 'quote_sent', label: 'Devis', description: 'Devis envoyé' },
  { status: 'quote_accepted', label: 'Acceptation', description: 'Devis accepté' },
  { status: 'awaiting_payment', label: 'Paiement', description: 'En attente de paiement' },
  { status: 'paid', label: 'Payé', description: 'Paiement confirmé' },
  { status: 'purchasing', label: 'Achat', description: 'Achat auprès du fournisseur' },
  { status: 'in_china_warehouse', label: 'Entrepôt', description: 'Produit en entrepôt Chine' },
  { status: 'shipped', label: 'Expédition', description: 'Expédié vers Haïti' },
  { status: 'in_transit', label: 'Transit', description: 'En transit maritime' },
  { status: 'arrived_haiti', label: 'Arrivée', description: 'Arrivé en Haïti' },
  { status: 'customs_processing', label: 'Douane', description: 'Dédouanement en cours' },
  { status: 'out_for_delivery', label: 'Livraison', description: 'En cours de livraison' },
  { status: 'delivered', label: 'Terminé', description: 'Commande livrée' },
]

const STATUS_ORDER: OrderStatus[] = [
  'draft', 'quote_sent', 'quote_accepted', 'awaiting_payment', 'paid',
  'purchasing', 'in_china_warehouse', 'shipped', 'in_transit',
  'arrived_haiti', 'customs_processing', 'out_for_delivery', 'delivered'
]

interface TimelineStepProps {
  currentStatus: OrderStatus
  className?: string
}

export function TimelineStep({ currentStatus, className }: TimelineStepProps) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus)

  return (
    <div className={cn('space-y-4', className)}>
      {ORDER_TIMELINE.map((step, index) => {
        const stepIndex = STATUS_ORDER.indexOf(step.status)
        const isCompleted = stepIndex <= currentIndex && currentIndex !== -1
        const isCurrent = step.status === currentStatus

        if (currentStatus === 'cancelled' || currentStatus === 'closed') {
          if (step.status === 'delivered') {
            return null
          }
        }

        return (
          <div key={step.status} className="relative flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                  isCompleted
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCurrent
                    ? 'border-primary bg-background'
                    : 'border-muted bg-background'
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className={cn('text-sm font-medium', isCurrent ? 'text-primary' : 'text-muted-foreground')}>
                    {index + 1}
                  </span>
                )}
              </div>
              {index < ORDER_TIMELINE.length - 1 && (
                <div
                  className={cn(
                    'h-full w-0.5 min-h-8 transition-colors',
                    isCompleted && stepIndex < currentIndex ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
            <div className="flex-1 pb-8">
              <p className={cn('font-medium', isCompleted || isCurrent ? 'text-foreground' : 'text-muted-foreground')}>
                {step.label}
              </p>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

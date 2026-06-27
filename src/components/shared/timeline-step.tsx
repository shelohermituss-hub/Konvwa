import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types'

import IconCreation    from 'flat-color-icons/svg/document.svg'
import IconDevis       from 'flat-color-icons/svg/fine_print.svg'
import IconAcceptation from 'flat-color-icons/svg/approve.svg'
import IconPaiement    from 'flat-color-icons/svg/money_transfer.svg'
import IconPaye        from 'flat-color-icons/svg/paid.svg'
import IconAchat       from 'flat-color-icons/svg/shop.svg'
import IconEntrepot    from 'flat-color-icons/svg/package.svg'
import IconNavire      from 'flat-color-icons/svg/shipped.svg'
import IconDouane      from 'flat-color-icons/svg/inspection.svg'
import IconArrivee     from 'flat-color-icons/svg/in_transit.svg'
import IconLivraison   from 'flat-color-icons/svg/advance.svg'
import IconLivre       from 'flat-color-icons/svg/ok.svg'

const ORDER_TIMELINE: {
  status: OrderStatus
  label: string
  description: string
  icon: string
}[] = [
  { status: 'draft',              label: 'Création',   description: 'Demande créée',                icon: IconCreation    },
  { status: 'quote_sent',         label: 'Devis',      description: 'Devis envoyé',                 icon: IconDevis       },
  { status: 'quote_accepted',     label: 'Acceptation',description: 'Devis accepté',                icon: IconAcceptation },
  { status: 'awaiting_payment',   label: 'Paiement',   description: 'En attente de paiement',       icon: IconPaiement    },
  { status: 'paid',               label: 'Payé',       description: 'Paiement confirmé',            icon: IconPaye        },
  { status: 'purchasing',         label: 'Achat',      description: 'Achat auprès du fournisseur',  icon: IconAchat       },
  { status: 'in_china_warehouse', label: 'Entrepôt',   description: 'Produit en entrepôt Chine',    icon: IconEntrepot    },
  { status: 'shipped',            label: 'Expédition', description: 'Expédié vers Haïti',           icon: IconNavire      },
  { status: 'in_transit',         label: 'Transit',    description: 'En transit maritime',          icon: IconNavire      },
  { status: 'arrived_haiti',      label: 'Arrivée',    description: 'Arrivé en Haïti',              icon: IconArrivee     },
  { status: 'customs_processing', label: 'Douane',     description: 'Dédouanement en cours',        icon: IconDouane      },
  { status: 'out_for_delivery',   label: 'Livraison',  description: 'En cours de livraison',        icon: IconLivraison   },
  { status: 'delivered',          label: 'Terminé',    description: 'Commande livrée',              icon: IconLivre       },
]

const STATUS_ORDER: OrderStatus[] = [
  'draft', 'quote_sent', 'quote_accepted', 'awaiting_payment', 'paid',
  'purchasing', 'in_china_warehouse', 'shipped', 'in_transit',
  'arrived_haiti', 'customs_processing', 'out_for_delivery', 'delivered',
]

interface TimelineStepProps {
  currentStatus: OrderStatus
  className?: string
}

export function TimelineStep({ currentStatus, className }: TimelineStepProps) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus)
  const isCancelled = currentStatus === 'cancelled' || currentStatus === 'closed'

  return (
    <div className={cn('space-y-0', className)}>
      {ORDER_TIMELINE.map((step, index) => {
        const stepIndex = STATUS_ORDER.indexOf(step.status)
        const isCompleted = !isCancelled && stepIndex <= currentIndex && currentIndex !== -1
        const isCurrent = step.status === currentStatus
        const isLast = index === ORDER_TIMELINE.length - 1

        return (
          <div key={step.status} className="relative flex gap-4 group">
            {/* Left: icon + connector line */}
            <div className="flex flex-col items-center shrink-0">
              {/* Icon bubble */}
              <div
                className={cn(
                  'relative z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-200',
                  isCompleted
                    ? 'border-primary/30 bg-white shadow-sm'
                    : isCurrent
                    ? 'border-primary bg-white shadow-md ring-4 ring-primary/10'
                    : 'border-border/40 bg-muted/30'
                )}
              >
                <img
                  src={step.icon}
                  alt=""
                  className={cn(
                    'h-6 w-6 object-contain transition-all duration-200',
                    !isCompleted && !isCurrent ? 'opacity-30 grayscale' : ''
                  )}
                />
                {/* Done overlay dot */}
                {isCompleted && !isCurrent && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary border-2 border-white">
                    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 fill-white">
                      <polyline points="1.5,5.5 3.5,7.5 8.5,2.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 flex-1 min-h-[28px] mt-1 transition-colors duration-300',
                    isCompleted && stepIndex < currentIndex ? 'bg-primary/40' : 'bg-border/40'
                  )}
                />
              )}
            </div>

            {/* Right: text */}
            <div className={cn('flex-1 pb-5 pt-1.5', isLast && 'pb-1')}>
              <p
                className={cn(
                  'font-semibold text-sm leading-tight transition-colors',
                  isCompleted || isCurrent ? 'text-foreground' : 'text-muted-foreground/60'
                )}
              >
                {step.label}
                {isCurrent && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-primary/12 text-primary text-[10px] font-bold px-2 py-0.5">
                    En cours
                  </span>
                )}
              </p>
              <p className={cn('text-xs mt-0.5', isCompleted || isCurrent ? 'text-muted-foreground' : 'text-muted-foreground/40')}>
                {step.description}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

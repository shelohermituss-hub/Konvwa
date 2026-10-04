import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

import { tr } from '@/lib/i18n'
const FULL_STEPS = [
  { key: 'submitted',  label: tr('Soumis'),    statuses: ['draft', 'submitted', 'reviewing', 'quote_sent'] },
  { key: 'quoted',     label: tr('Devis'),     statuses: ['quoted'] },
  { key: 'paid',       label: tr('Payé'),      statuses: ['awaiting_payment', 'paid', 'purchasing'] },
  { key: 'warehouse',  label: tr('Entrepôt'),  statuses: ['in_china_warehouse'] },
  { key: 'shipped',    label: tr('Expédié'),   statuses: ['shipped'] },
  { key: 'transit',    label: tr('Transit'),   statuses: ['in_transit'] },
  { key: 'arrived',    label: tr('Arrivée'),   statuses: ['arrived', 'arrived_haiti', 'customs', 'customs_clearance', 'customs_processing'] },
  { key: 'delivering', label: tr('Livraison'), statuses: ['delivery', 'delivering', 'out_for_delivery'] },
  { key: 'delivered',  label: tr('Livré'),     statuses: ['delivered', 'completed'] },
] as const

type StepList = typeof FULL_STEPS

function getStepIndex(status: string, steps: StepList): number {
  for (let i = 0; i < steps.length; i++) {
    if ((steps[i].statuses as readonly string[]).includes(status)) return i
  }
  return 0
}

interface OrderStatusTrackerProps {
  status: string
  shippingOption?: 'all_inclusive' | 'separate' | string
  className?: string
}

export function OrderStatusTracker({ status, className }: OrderStatusTrackerProps) {
  const isCancelled = status === 'cancelled'
  const steps: StepList = FULL_STEPS  // separate-shipping orders now go all the way too: the cargo drives their status
  const activeIndex = getStepIndex(status, steps)

  if (isCancelled) {
    return (
      <div className={cn('rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-center', className)}>
        <p className="text-sm font-semibold text-destructive">{tr('Commande annulée')}</p>
      </div>
    )
  }

  return (
    <div className={cn('overflow-x-auto scrollbar-hide', className)}>
      <div className="flex items-center min-w-max px-1 py-2">
        {steps.map((step, index) => {
          const isDone = index < activeIndex
          const isActive = index === activeIndex
          const isUpcoming = index > activeIndex

          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                    isDone    && 'border-primary bg-primary text-primary-foreground',
                    isActive  && 'border-primary bg-primary/10 text-primary shadow-sm',
                    isUpcoming && 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {isDone ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <div
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        isActive  && 'bg-primary animate-pulse',
                        isUpcoming && 'bg-muted-foreground/30',
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium whitespace-nowrap',
                    isDone    && 'text-primary',
                    isActive  && 'text-primary font-semibold',
                    isUpcoming && 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-8 mx-1 mb-5 rounded-full transition-colors',
                    index < activeIndex ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

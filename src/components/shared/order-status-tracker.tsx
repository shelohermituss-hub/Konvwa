import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

const FULL_STEPS = [
  { key: 'submitted',  label: 'Soumis',    statuses: ['draft', 'submitted', 'reviewing', 'quote_sent'] },
  { key: 'quoted',     label: 'Devis',     statuses: ['quoted'] },
  { key: 'paid',       label: 'Payé',      statuses: ['awaiting_payment', 'paid', 'purchasing'] },
  { key: 'warehouse',  label: 'Entrepôt',  statuses: ['in_china_warehouse'] },
  { key: 'shipped',    label: 'Expédié',   statuses: ['shipped'] },
  { key: 'transit',    label: 'Transit',   statuses: ['in_transit'] },
  { key: 'arrived',    label: 'Arrivée',   statuses: ['arrived', 'customs', 'customs_clearance'] },
  { key: 'delivering', label: 'Livraison', statuses: ['delivery', 'delivering'] },
  { key: 'delivered',  label: 'Livré',     statuses: ['delivered', 'completed'] },
] as const

// For separate (achat seulement) orders, the tracker ends at Entrepôt.
// Any status beyond in_china_warehouse also maps to the last step so it shows complete.
const SEPARATE_STEPS = [
  { key: 'submitted', label: 'Soumis',   statuses: ['draft', 'submitted', 'reviewing', 'quote_sent'] },
  { key: 'quoted',    label: 'Devis',    statuses: ['quoted'] },
  { key: 'paid',      label: 'Payé',     statuses: ['awaiting_payment', 'paid', 'purchasing'] },
  {
    key: 'warehouse',
    label: 'Entrepôt',
    statuses: [
      'in_china_warehouse',
      'shipped', 'in_transit', 'arrived', 'customs', 'customs_clearance',
      'delivery', 'delivering', 'delivered', 'completed',
    ],
  },
] as const

type StepList = typeof FULL_STEPS | typeof SEPARATE_STEPS

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

export function OrderStatusTracker({ status, shippingOption, className }: OrderStatusTrackerProps) {
  const isCancelled = status === 'cancelled'
  const steps: StepList = shippingOption === 'separate' ? SEPARATE_STEPS : FULL_STEPS
  const activeIndex = getStepIndex(status, steps)

  if (isCancelled) {
    return (
      <div className={cn('rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-center', className)}>
        <p className="text-sm font-semibold text-destructive">Commande annulée</p>
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

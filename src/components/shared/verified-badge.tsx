import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

/** Blue "verified" seal (supplier, purchase or identity checked). */
export function VerifiedBadge({ className, label }: { className?: string; label?: string }) {
  return <img src="/brands/verified.png" alt={label ?? tr('Vérifié')} title={label ?? tr('Vérifié')} className={cn('inline-block h-4 w-4 shrink-0 select-none', className)} draggable={false} />
}

import { cn } from '@/lib/utils'

/** The carrier's logo on a white tile (logos are drawn for light backgrounds); nothing when the rate has no logo. */
export function CarrierLogo({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  if (!src) return null
  return (
    <span className={cn('flex h-9 w-14 shrink-0 items-center justify-center rounded-lg border border-black/5 bg-white p-1', className)}>
      <img src={src} alt={name} loading="lazy" className="max-h-full max-w-full object-contain" />
    </span>
  )
}

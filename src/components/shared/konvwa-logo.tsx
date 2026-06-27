import { cn } from '@/lib/utils'

interface KonvwaLogoProps {
  /** Show just the icon (default false shows icon + wordmark) */
  iconOnly?: boolean
  /** Icon size in px (applies to the SVG height) */
  size?: number
  className?: string
}

export function KonvwaLogo({ iconOnly = false, size = 28, className }: KonvwaLogoProps) {
  return (
    <div className={cn('flex items-center gap-2 select-none', className)}>
      {/* 3-crates icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 110 72"
        fill="none"
        style={{ height: size, width: 'auto' }}
        aria-hidden="true"
      >
        {/* Shadows */}
        <rect x="1"  y="45" width="40" height="24" rx="6" fill="black" opacity="0.10"/>
        <rect x="35" y="29" width="40" height="24" rx="6" fill="black" opacity="0.10"/>
        <rect x="69" y="13" width="40" height="24" rx="6" fill="black" opacity="0.10"/>

        {/* Box 1 — dark brown-red */}
        <rect x="0"  y="42" width="40" height="24" rx="6" fill="#8B2200"/>
        <rect x="0"  y="42" width="9"  height="24" rx="6" fill="#6B1800"/>
        <rect x="31" y="42" width="9"  height="24" rx="6" fill="#6B1800"/>
        <rect x="9" y="48"   width="22" height="2.5" rx="1.2" fill="#7A1E00"/>
        <rect x="9" y="52.5" width="22" height="2.5" rx="1.2" fill="#7A1E00"/>
        <rect x="9" y="57"   width="22" height="2.5" rx="1.2" fill="#7A1E00"/>

        {/* Box 2 — orange-red */}
        <rect x="34" y="26" width="40" height="24" rx="6" fill="#E53D15"/>
        <rect x="34" y="26" width="9"  height="24" rx="6" fill="#C23010"/>
        <rect x="65" y="26" width="9"  height="24" rx="6" fill="#C23010"/>
        <rect x="43" y="32"   width="22" height="2.5" rx="1.2" fill="#CC3510"/>
        <rect x="43" y="36.5" width="22" height="2.5" rx="1.2" fill="#CC3510"/>
        <rect x="43" y="41"   width="22" height="2.5" rx="1.2" fill="#CC3510"/>

        {/* Box 3 — coral-orange */}
        <rect x="68" y="10" width="40" height="24" rx="6" fill="#FF7252"/>
        <rect x="68" y="10" width="9"  height="24" rx="6" fill="#E05A3A"/>
        <rect x="99" y="10" width="9"  height="24" rx="6" fill="#E05A3A"/>
        <rect x="77" y="16"   width="22" height="2.5" rx="1.2" fill="#EE6040"/>
        <rect x="77" y="20.5" width="22" height="2.5" rx="1.2" fill="#EE6040"/>
        <rect x="77" y="25"   width="22" height="2.5" rx="1.2" fill="#EE6040"/>
      </svg>

      {!iconOnly && (
        <span className="font-bold text-base tracking-tight text-foreground leading-none">
          KONVWA
        </span>
      )}
    </div>
  )
}

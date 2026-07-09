/* Custom SVG illustrations for KONVWA — brand colors: #F05A28 / #0A1628 */

export function IllustrationEmptyOrders({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Shadow */}
      <ellipse cx="100" cy="148" rx="52" ry="8" fill="#0A1628" opacity="0.08" />

      {/* Ground platform */}
      <rect x="48" y="120" width="104" height="6" rx="3" fill="#E5E7EB" />

      {/* Box body */}
      <rect x="62" y="68" width="76" height="56" rx="6" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1.5" />

      {/* Box top flaps */}
      <path d="M62 74 L100 82 L138 74" stroke="#E5E7EB" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M62 74 L62 68 L100 60 L138 68 L138 74" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Tape stripe on box */}
      <rect x="88" y="68" width="24" height="52" rx="0" fill="#F05A28" opacity="0.12" />
      <rect x="88" y="60" width="24" height="14" rx="0" fill="#F05A28" opacity="0.12" />

      {/* KONVWA logo mark on box */}
      <rect x="78" y="86" width="44" height="28" rx="4" fill="white" stroke="#E5E7EB" strokeWidth="1" />
      <path
        d="M88 106 L94 96 L100 104 L106 93 L112 106"
        stroke="#F05A28"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Stars / sparkles */}
      <circle cx="44" cy="72" r="3.5" fill="#F05A28" opacity="0.25" />
      <circle cx="158" cy="90" r="2.5" fill="#F05A28" opacity="0.20" />
      <circle cx="52" cy="100" r="2" fill="#0A1628" opacity="0.10" />

      {/* Dashed path lines */}
      <path
        d="M44 120 C44 120 30 100 36 80 C42 60 60 52 80 56"
        stroke="#F05A28"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M156 120 C156 120 170 100 164 80 C158 60 140 52 120 56"
        stroke="#F05A28"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeLinecap="round"
        opacity="0.3"
      />

      {/* Question marks */}
      <text x="33" y="95" fontSize="14" fill="#F05A28" opacity="0.35" fontFamily="sans-serif" fontWeight="bold">?</text>
      <text x="160" y="80" fontSize="11" fill="#0A1628" opacity="0.20" fontFamily="sans-serif" fontWeight="bold">?</text>
    </svg>
  )
}

export function IllustrationEmptyCart({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Shadow */}
      <ellipse cx="100" cy="148" rx="44" ry="7" fill="#0A1628" opacity="0.07" />

      {/* Bag body */}
      <path
        d="M66 76 L72 132 C72 135.3 74.7 138 78 138 L122 138 C125.3 138 128 135.3 128 132 L134 76 Z"
        fill="#F9FAFB"
        stroke="#E5E7EB"
        strokeWidth="1.5"
      />

      {/* Bag handle */}
      <path
        d="M84 76 C84 64 116 64 116 76"
        stroke="#D1D5DB"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Plus icon in bag */}
      <circle cx="100" cy="107" r="18" fill="#F05A28" opacity="0.08" />
      <path d="M100 99 L100 115 M92 107 L108 107" stroke="#F05A28" strokeWidth="2.5" strokeLinecap="round" />

      {/* Floating items */}
      <rect x="28" y="58" width="26" height="20" rx="5" fill="white" stroke="#E5E7EB" strokeWidth="1.2"
        transform="rotate(-12 28 58)" opacity="0.7" />
      <rect x="148" y="62" width="22" height="18" rx="4" fill="white" stroke="#E5E7EB" strokeWidth="1.2"
        transform="rotate(10 148 62)" opacity="0.7" />
      <rect x="36" y="86" width="18" height="14" rx="3" fill="#F05A28" opacity="0.10"
        transform="rotate(-8 36 86)" />
      <rect x="150" y="88" width="16" height="12" rx="3" fill="#F05A28" opacity="0.10"
        transform="rotate(6 150 88)" />

      {/* Stars */}
      <circle cx="46" cy="54" r="2.5" fill="#F05A28" opacity="0.25" />
      <circle cx="162" cy="76" r="2" fill="#F05A28" opacity="0.20" />
    </svg>
  )
}

export function IllustrationEmptyProducts({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Shadow */}
      <ellipse cx="100" cy="148" rx="56" ry="8" fill="#0A1628" opacity="0.07" />

      {/* Store shelf back */}
      <rect x="36" y="60" width="128" height="78" rx="8" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1.5" />

      {/* Shelf planks */}
      <rect x="36" y="96" width="128" height="5" rx="2.5" fill="#E5E7EB" />
      <rect x="36" y="130" width="128" height="5" rx="2.5" fill="#E5E7EB" />

      {/* Store sign top */}
      <rect x="52" y="52" width="96" height="16" rx="4" fill="#0A1628" />
      <circle cx="68" cy="60" r="3" fill="#F05A28" />
      <rect x="74" y="57" width="40" height="4" rx="2" fill="white" opacity="0.6" />
      <rect x="74" y="63" width="26" height="3" rx="1.5" fill="white" opacity="0.3" />

      {/* Empty shelf items — outlines showing missing products */}
      <rect x="46" y="103" width="28" height="22" rx="4" fill="white" stroke="#E5E7EB" strokeWidth="1.2" strokeDasharray="3 2" />
      <rect x="80" y="103" width="28" height="22" rx="4" fill="white" stroke="#E5E7EB" strokeWidth="1.2" strokeDasharray="3 2" />
      <rect x="114" y="103" width="28" height="22" rx="4" fill="white" stroke="#E5E7EB" strokeWidth="1.2" strokeDasharray="3 2" />

      <rect x="46" y="67" width="28" height="22" rx="4" fill="white" stroke="#E5E7EB" strokeWidth="1.2" strokeDasharray="3 2" />
      <rect x="80" y="67" width="28" height="22" rx="4" fill="white" stroke="#E5E7EB" strokeWidth="1.2" strokeDasharray="3 2" />
      <rect x="114" y="67" width="28" height="22" rx="4" fill="white" stroke="#F05A28" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.5" />

      {/* Sparkle on one slot */}
      <path d="M128 72 L129.5 75.5 L133 77 L129.5 78.5 L128 82 L126.5 78.5 L123 77 L126.5 75.5 Z"
        fill="#F05A28" opacity="0.35" />

      {/* Floating tag */}
      <rect x="152" y="54" width="30" height="18" rx="5" fill="white" stroke="#E5E7EB" strokeWidth="1.2" />
      <circle cx="157" cy="63" r="2.5" fill="#F05A28" opacity="0.5" />
      <rect x="162" y="60" width="14" height="3" rx="1.5" fill="#E5E7EB" />
      <rect x="162" y="65" width="10" height="2.5" rx="1.25" fill="#E5E7EB" />
    </svg>
  )
}

export function IllustrationDeliveryHero({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Globe */}
      <circle cx="46" cy="60" r="32" fill="white" opacity="0.06" />
      <circle cx="46" cy="60" r="24" fill="white" opacity="0.06" />
      <circle cx="46" cy="60" r="16" stroke="white" strokeWidth="1" opacity="0.15" />
      <path d="M30 60 C30 52 38 46 46 46 C54 46 62 52 62 60 C62 68 54 74 46 74 C38 74 30 68 30 60Z"
        stroke="white" strokeWidth="1" opacity="0.12" fill="none" />
      <path d="M46 44 L46 76 M30 60 L62 60" stroke="white" strokeWidth="0.75" opacity="0.12" />

      {/* Globe continent shapes */}
      <path d="M36 54 C38 51 42 50 46 51 C49 52 51 50 53 52 C55 54 53 57 50 56 C47 55 45 58 42 57 C39 56 36 57 36 54Z"
        fill="white" opacity="0.10" />
      <path d="M38 64 C40 62 43 63 45 65 C47 67 44 69 42 68 C40 67 38 66 38 64Z"
        fill="white" opacity="0.08" />

      {/* Dashed path from globe to package */}
      <path
        d="M66 60 C80 50 110 44 140 54"
        stroke="white"
        strokeWidth="1.2"
        strokeDasharray="4 3"
        opacity="0.25"
        strokeLinecap="round"
      />

      {/* Package / box */}
      <rect x="138" y="36" width="48" height="48" rx="8" fill="white" opacity="0.10" />
      <rect x="142" y="40" width="40" height="40" rx="6" fill="white" opacity="0.08" />
      <rect x="146" y="44" width="32" height="32" rx="5" fill="white" opacity="0.08" />

      {/* Package front face */}
      <rect x="148" y="46" width="28" height="28" rx="4" fill="#F05A28" opacity="0.90" />
      <path d="M148 56 L176 56" stroke="white" strokeWidth="1" opacity="0.4" />
      <rect x="158" y="46" width="8" height="28" fill="white" opacity="0.10" />

      {/* KONVWA K on package */}
      <path d="M157 52 L157 68 M157 60 L164 52 M157 60 L164 68"
        stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Location pin */}
      <circle cx="162" cy="18" r="8" fill="#F05A28" opacity="0.80" />
      <circle cx="162" cy="18" r="4" fill="white" />
      <path d="M162 26 L162 32" stroke="#F05A28" strokeWidth="1.5" strokeLinecap="round" opacity="0.60" />

      {/* Sparkle dots */}
      <circle cx="104" cy="38" r="2.5" fill="white" opacity="0.20" />
      <circle cx="118" cy="78" r="2" fill="#F05A28" opacity="0.35" />
      <circle cx="88" cy="72" r="1.5" fill="white" opacity="0.15" />
      <circle cx="132" cy="30" r="1.5" fill="white" opacity="0.20" />

      {/* Motion lines on package */}
      <path d="M134 54 L128 54 M134 60 L126 60 M134 66 L130 66"
        stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.15" />
    </svg>
  )
}

export function IllustrationWallet({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Shadow */}
      <ellipse cx="100" cy="148" rx="50" ry="7" fill="#0A1628" opacity="0.07" />

      {/* Card back */}
      <rect x="52" y="52" width="110" height="70" rx="10" fill="#E5E7EB"
        transform="rotate(-6 52 52)" />

      {/* Card main */}
      <rect x="38" y="56" width="110" height="70" rx="10" fill="#0A1628" />
      <rect x="38" y="72" width="110" height="18" fill="white" opacity="0.06" />

      {/* Chip */}
      <rect x="50" y="64" width="20" height="16" rx="3" fill="#F05A28" opacity="0.8" />
      <path d="M55 64 L55 80 M60 64 L60 80 M65 64 L65 80" stroke="#0A1628" strokeWidth="0.8" opacity="0.4" />

      {/* Card number dots */}
      <circle cx="50" cy="96" r="2.5" fill="white" opacity="0.5" />
      <circle cx="56" cy="96" r="2.5" fill="white" opacity="0.5" />
      <circle cx="62" cy="96" r="2.5" fill="white" opacity="0.5" />
      <circle cx="68" cy="96" r="2.5" fill="white" opacity="0.5" />
      <circle cx="78" cy="96" r="2.5" fill="white" opacity="0.5" />
      <circle cx="84" cy="96" r="2.5" fill="white" opacity="0.5" />
      <circle cx="90" cy="96" r="2.5" fill="white" opacity="0.5" />
      <circle cx="96" cy="96" r="2.5" fill="white" opacity="0.5" />

      {/* HTG amount */}
      <text x="50" y="116" fontSize="9" fill="white" opacity="0.4" fontFamily="sans-serif">HTG</text>
      <text x="62" y="116" fontSize="11" fill="white" opacity="0.9" fontFamily="sans-serif" fontWeight="bold">5,000</text>

      {/* Phone icon with MonCash orange */}
      <rect x="122" y="66" width="26" height="48" rx="6" fill="white" opacity="0.08" stroke="white" strokeWidth="1" strokeOpacity="0.15" />
      <rect x="128" y="72" width="14" height="24" rx="2" fill="#F05A28" opacity="0.70" />
      <circle cx="135" cy="106" r="3" fill="white" opacity="0.4" />

      {/* Arrow up (deposit) */}
      <circle cx="168" cy="76" r="14" fill="#F05A28" opacity="0.12" />
      <path d="M168 84 L168 68 M162 74 L168 68 L174 74"
        stroke="#F05A28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Stars */}
      <circle cx="40" cy="60" r="2.5" fill="#F05A28" opacity="0.25" />
      <circle cx="168" cy="108" r="2" fill="#0A1628" opacity="0.15" />
    </svg>
  )
}

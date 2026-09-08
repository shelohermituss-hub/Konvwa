<title>Wallet Card Skin</title>
import type { ReactNode } from 'react'

// ── Skin definitions ──────────────────────────────────────────────────────────

interface CardSkin {
  bg: string
  shadow: string
  deco: ReactNode
}

const SKINS: CardSkin[] = [
  // 0 — Dark Organic  (inspired by Cardy #1)
  {
    bg: '#181818',
    shadow: '0 14px 48px rgba(0,0,0,0.60)',
    deco: (
      <svg viewBox="0 0 630 397" xmlns="http://www.w3.org/2000/svg"
           className="absolute inset-0 w-full h-full" aria-hidden="true">
        <path d="M308 0 Q372 26 428 92 Q490 168 510 252 Q530 332 582 370 Q607 386 630 397 L630 0 Z"
              fill="#272727"/>
        <path d="M398 0 Q444 57 417 150 Q392 230 450 310 Q490 370 542 397 L630 397 L630 292
                 Q574 254 546 184 Q520 116 558 57 Q577 20 594 0 Z"
              fill="#303030"/>
        <ellipse cx="488" cy="138" rx="17" ry="8" fill="#1A1A1A"/>
        <ellipse cx="453" cy="230" rx="10" ry="16" fill="#1A1A1A"/>
        <ellipse cx="562" cy="290" rx="7"  ry="11" fill="#1A1A1A"/>
        <circle  cx="526" cy="176" r="5"          fill="#1A1A1A"/>
      </svg>
    ),
  },

  // 1 — Violet Split  (inspired by Cardy #5)
  {
    bg: '#0C0C0C',
    shadow: '0 14px 48px rgba(124,58,237,0.45)',
    deco: (
      <svg viewBox="0 0 630 397" xmlns="http://www.w3.org/2000/svg"
           className="absolute inset-0 w-full h-full" aria-hidden="true">
        {/* top-right triangle */}
        <polygon points="258,0 630,0 630,238"
                 fill="url(#skin1-grad-top)"/>
        {/* bottom-right triangle */}
        <polygon points="630,145 630,397 312,397"
                 fill="url(#skin1-grad-bot)"/>
        <defs>
          <linearGradient id="skin1-grad-top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C4B5FD"/>
            <stop offset="100%" stopColor="#7C3AED"/>
          </linearGradient>
          <linearGradient id="skin1-grad-bot" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6D28D9"/>
            <stop offset="100%" stopColor="#4C1D95"/>
          </linearGradient>
        </defs>
      </svg>
    ),
  },

  // 2 — Botanical Green  (inspired by Cardy #10)
  {
    bg: '#1B9457',
    shadow: '0 14px 48px rgba(27,148,87,0.52)',
    deco: (
      <svg viewBox="0 0 630 397" xmlns="http://www.w3.org/2000/svg"
           className="absolute inset-0 w-full h-full" aria-hidden="true">
        {([
          [88,68,38,10],[228,128,32,47],[402,54,42,82],[534,94,29,119],
          [148,264,37,156],[318,318,34,193],[478,272,40,230],[590,184,34,267],
          [54,352,29,304],[442,358,32,341],
        ] as [number,number,number,number][]).map(([cx,cy,r,a]) => (
          <ellipse key={a} cx={cx} cy={cy} rx={r * 0.52} ry={r}
                   transform={`rotate(${a} ${cx} ${cy})`}
                   fill="white" fillOpacity="0.16"/>
        ))}
      </svg>
    ),
  },

  // 3 — Purple Arc Split  (inspired by Cardy #15)
  {
    bg: '#6D28D9',
    shadow: '0 14px 48px rgba(109,40,217,0.52)',
    deco: (
      <svg viewBox="0 0 630 397" xmlns="http://www.w3.org/2000/svg"
           className="absolute inset-0 w-full h-full" aria-hidden="true">
        <rect x="0" y="208" width="630" height="189" fill="#1A1A1A"/>
        {[0,1,2,3,4,5,6].map(i => (
          <path key={i}
                d={`M ${-30 + i * 62} 397 Q ${100 + i * 62} 262 ${250 + i * 62} 397`}
                fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1.6"/>
        ))}
        {[0,1,2,3,4,5].map(i => (
          <path key={`b${i}`}
                d={`M ${15 + i * 62} 397 Q ${85 + i * 62} 252 ${205 + i * 62} 397`}
                fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1.2"/>
        ))}
      </svg>
    ),
  },

  // 4 — Dark Gold Wave  (inspired by Cardy #20)
  {
    bg: '#111111',
    shadow: '0 14px 48px rgba(245,158,11,0.38)',
    deco: (
      <svg viewBox="0 0 630 397" xmlns="http://www.w3.org/2000/svg"
           className="absolute inset-0 w-full h-full" aria-hidden="true">
        <rect x="0" y="218" width="630" height="179" fill="#F59E0B"/>
        {[0,1,2,3,4].map(i => (
          <path key={i}
                d={`M 0 ${246 + i * 24} Q 158 ${232 + i * 24} 315 ${256 + i * 24}
                    Q 472 ${280 + i * 24} 630 ${246 + i * 24}`}
                fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1.4"/>
        ))}
      </svg>
    ),
  },

  // 5 — KONVWA Navy-Orange  (brand signature)
  {
    bg: 'linear-gradient(140deg, #0A1628 0%, #1C2F50 48%, #B84220 100%)',
    shadow: '0 14px 48px rgba(240,90,40,0.42)',
    deco: (
      <svg viewBox="0 0 630 397" xmlns="http://www.w3.org/2000/svg"
           className="absolute inset-0 w-full h-full" aria-hidden="true">
        <circle cx="510" cy="198" r="210" fill="rgba(240,90,40,0.14)"/>
        <circle cx="560" cy="148" r="140" fill="rgba(240,90,40,0.10)"/>
        <circle cx="610" cy="310" r="90"  fill="rgba(240,90,40,0.08)"/>
      </svg>
    ),
  },

  // 6 — Midnight Circuit
  {
    bg: '#080C24',
    shadow: '0 14px 48px rgba(8,12,36,0.75)',
    deco: (
      <svg viewBox="0 0 630 397" xmlns="http://www.w3.org/2000/svg"
           className="absolute inset-0 w-full h-full" aria-hidden="true">
        <line x1="210" y1="0"   x2="210" y2="397" stroke="rgba(99,102,241,0.14)" strokeWidth="1"/>
        <line x1="420" y1="0"   x2="420" y2="397" stroke="rgba(99,102,241,0.10)" strokeWidth="1"/>
        <line x1="0"   y1="132" x2="630" y2="132" stroke="rgba(99,102,241,0.12)" strokeWidth="1"/>
        <line x1="0"   y1="264" x2="630" y2="264" stroke="rgba(99,102,241,0.09)" strokeWidth="1"/>
        <circle cx="210" cy="132" r="4" fill="rgba(99,102,241,0.32)"/>
        <circle cx="420" cy="132" r="4" fill="rgba(99,102,241,0.32)"/>
        <circle cx="210" cy="264" r="4" fill="rgba(99,102,241,0.24)"/>
        <circle cx="420" cy="264" r="4" fill="rgba(99,102,241,0.24)"/>
        <line x1="420" y1="0"   x2="630" y2="180" stroke="rgba(99,102,241,0.18)" strokeWidth="1.6"/>
        <line x1="210" y1="397" x2="0"   y2="217" stroke="rgba(99,102,241,0.12)" strokeWidth="1"/>
      </svg>
    ),
  },

  // 7 — Crimson
  {
    bg: 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 50%, #DC2626 100%)',
    shadow: '0 14px 48px rgba(185,28,28,0.48)',
    deco: (
      <svg viewBox="0 0 630 397" xmlns="http://www.w3.org/2000/svg"
           className="absolute inset-0 w-full h-full" aria-hidden="true">
        <circle cx="575" cy="80"  r="168" fill="rgba(255,255,255,0.07)"/>
        <circle cx="535" cy="335" r="125" fill="rgba(0,0,0,0.14)"/>
        <circle cx="78"  cy="352" r="105" fill="rgba(255,255,255,0.04)"/>
      </svg>
    ),
  },

  // 8 — Ocean Teal
  {
    bg: 'linear-gradient(135deg, #0F4C5C 0%, #0E7490 55%, #0EA5E9 100%)',
    shadow: '0 14px 48px rgba(14,116,144,0.52)',
    deco: (
      <svg viewBox="0 0 630 397" xmlns="http://www.w3.org/2000/svg"
           className="absolute inset-0 w-full h-full" aria-hidden="true">
        {[0,1,2,3,4,5].map(i => (
          <path key={i}
                d={`M 0 ${55 + i * 52} Q 158 ${28 + i * 52} 315 ${68 + i * 52}
                    Q 472 ${108 + i * 52} 630 ${55 + i * 52}`}
                fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5"/>
        ))}
      </svg>
    ),
  },

  // 9 — Rose Dusk
  {
    bg: 'linear-gradient(135deg, #4A0E2E 0%, #831843 50%, #BE185D 100%)',
    shadow: '0 14px 48px rgba(131,24,67,0.50)',
    deco: (
      <svg viewBox="0 0 630 397" xmlns="http://www.w3.org/2000/svg"
           className="absolute inset-0 w-full h-full" aria-hidden="true">
        <circle cx="590" cy="60"  r="190" fill="rgba(255,255,255,0.06)"/>
        <circle cx="40"  cy="340" r="150" fill="rgba(255,255,255,0.04)"/>
        <ellipse cx="315" cy="200" rx="250" ry="80" fill="rgba(255,255,255,0.03)"/>
      </svg>
    ),
  },
]

// ── Deterministic skin picker ─────────────────────────────────────────────────

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function getCardSkin(userId: string): CardSkin {
  return SKINS[hashId(userId) % SKINS.length]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WalletCardSkin({
  userId,
  children,
}: {
  userId: string
  children: ReactNode
}) {
  const skin = getCardSkin(userId)
  return (
    <div
      className="rounded-3xl text-white relative overflow-hidden"
      style={{ background: skin.bg, boxShadow: skin.shadow, aspectRatio: '1.586' }}
    >
      {skin.deco}
      <div className="absolute inset-0 z-10 flex flex-col justify-between p-4">
        {children}
      </div>
    </div>
  )
}

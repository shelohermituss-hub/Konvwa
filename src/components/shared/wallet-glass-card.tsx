import { Eye, EyeOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { tr, LOCALE_TAG } from '@/lib/i18n'

/**
 * Wallet card: a black metal payment card. Light grey glow in the bottom-left fading to pure black on the right, a silver
 * EMV chip with the contactless symbol, two overlapping dark discs in the top-right corner, the holder name in bold white.
 * It looks the same on the light and the dark page (it is a physical-card look, so colours are fixed, not themed).
 */
export function WalletGlassCard({ balance, visible, loading, onToggle, holder, cardNumber }: {
  balance: number
  visible: boolean
  loading: boolean
  onToggle: () => void
  holder: string
  cardNumber: string
}) {
  return (
    <div
      className="relative overflow-hidden text-[#ffffff]"
      style={{
        aspectRatio: '1.586',
        borderRadius: '5.5% / 8.7%',
        background: [
          'radial-gradient(120% 120% at 0% 100%, #636363 0%, #3c3c3c 28%, #1c1c1c 55%, #050505 82%, #000000 100%)',
        ].join(', '),
        boxShadow: [
          '0 1px 0 rgba(255,255,255,0.18) inset',
          '0 -1px 0 rgba(0,0,0,0.6) inset',
          '0 12px 24px -8px rgba(0,0,0,0.45)',
          '0 30px 50px -24px rgba(0,0,0,0.5)',
        ].join(', '),
      }}
    >
      {/* soft top sheen */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0))' }} />
      <div aria-hidden="true" className="wallet-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[#ffffff]/10 to-transparent" />

      {/* two overlapping dark discs, top right */}
      <div aria-hidden="true" className="absolute right-[5%] top-[9.5%] w-[21%]">
        <span className="block aspect-square w-full" />
        <span className="absolute left-0 top-0 aspect-square w-[62%] rounded-full" style={{ background: 'rgba(70,70,70,0.55)' }} />
        <span className="absolute right-0 top-0 aspect-square w-[62%] rounded-full" style={{ background: 'rgba(0,0,0,0.55)' }} />
      </div>

      {/* chip + contactless */}
      <div className="absolute left-[11.6%] right-0 top-[33.5%] flex items-center gap-[3.2%]" aria-hidden="true">
        <svg viewBox="0 0 132 96" className="w-[15.5%] shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
          <defs>
            <linearGradient id="kw-chip" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f4f4f4" />
              <stop offset="0.45" stopColor="#bdbdbd" />
              <stop offset="1" stopColor="#7d7d7d" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="130" height="94" rx="16" fill="url(#kw-chip)" stroke="#8a8a8a" strokeWidth="1.5" />
          <g fill="none" stroke="#6f6f6f" strokeWidth="1.6" strokeOpacity="0.8">
            <path d="M1 32h34M97 32h34M1 64h34M97 64h34" />
            <path d="M35 1v94M97 1v94" strokeOpacity="0.35" />
            <path d="M35 32c0-18 14-30 31-30s31 12 31 30M35 64c0 18 14 30 31 30s31-12 31-30" strokeOpacity="0.55" />
            <path d="M35 32v32M97 32v32" strokeOpacity="0.55" />
          </g>
        </svg>
        <svg viewBox="0 0 40 60" className="w-[5.2%] shrink-0 overflow-visible">
          <g fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round">
            <path d="M6 22c3 5 3 11 0 16" />
            <path d="M14 15c6 10 6 20 0 30" />
            <path d="M23 8c9 14 9 30 0 44" />
          </g>
        </svg>
      </div>

      {/* wordmark + eye */}
      <div className="absolute left-[11.6%] top-[10%] text-[11px] font-black tracking-[0.2em] text-[#ffffff]/80">KONVWA</div>

      {/* balance */}
      <div className="absolute right-[6%] top-[46%] max-w-[46%] text-right">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#ffffff]/55">{tr('Solde disponible')}</p>
        {loading ? (
          <Skeleton className="ml-auto h-7 w-32 rounded-lg bg-[#ffffff]/15" />
        ) : (
          <p className="text-[1.45rem] font-bold leading-none tracking-wide tabular-nums">
            {visible ? balance.toLocaleString(LOCALE_TAG) : '•••••'}
            <span className="ml-1 text-[11px] font-semibold text-[#ffffff]/65">HTG</span>
          </p>
        )}
      </div>

      {/* bottom row: holder, account number, eye */}
      <div className="absolute inset-x-[11.6%] bottom-[9%] flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[clamp(14px,5.6vw,26px)] font-bold uppercase leading-none tracking-tight">{holder}</p>
          <p className="mt-1.5 font-mono text-[9px] font-semibold tracking-wider text-[#ffffff]/50">{cardNumber}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? tr('Masquer le solde') : tr('Afficher le solde')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ffffff]/25 bg-[#ffffff]/10 text-[#ffffff] transition-colors hover:bg-[#ffffff]/20"
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

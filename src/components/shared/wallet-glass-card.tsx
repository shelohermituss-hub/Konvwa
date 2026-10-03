import { Eye, EyeOff, Wifi } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { tr, LOCALE_TAG } from '@/lib/i18n'

/**
 * Wallet card, glassmorphism style: a vivid gradient with blurred colour blobs behind a frosted glass panel
 * (backdrop blur, light border, top-left sheen) and a slow light sweep. Self-contained colours: same look in light and dark.
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
      className="relative isolate overflow-hidden rounded-[28px] text-white"
      style={{
        aspectRatio: '1.586',
        background: 'linear-gradient(135deg, #1b1744 0%, #3b1d7a 38%, #b4235f 72%, #F05A28 100%)',
        boxShadow: '0 18px 44px -12px rgba(124, 58, 237, 0.55), 0 8px 20px -8px rgba(240, 90, 40, 0.45)',
      }}
    >
      {/* colour blobs: what the glass blurs */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-[#F05A28] opacity-80 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-14 -left-8 h-48 w-48 rounded-full bg-[#38bdf8] opacity-60 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/3 top-1/3 h-32 w-32 rounded-full bg-[#ec4899] opacity-50 blur-3xl" />

      {/* frosted glass panel */}
      <div
        className="absolute inset-2.5 overflow-hidden rounded-[22px] border border-white/25 backdrop-blur-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.03) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div aria-hidden="true" className="wallet-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </div>

      <div className="absolute inset-0 flex flex-col justify-between p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-[0.2em] drop-shadow-sm">KONVWA</span>
            <span className="rounded-md border border-white/30 bg-white/15 px-1.5 py-0.5 text-[9px] font-bold tracking-widest backdrop-blur-sm">PAY</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5 rotate-90 text-white/80" aria-hidden="true" />
            <button
              type="button"
              onClick={onToggle}
              aria-label={visible ? tr('Masquer le solde') : tr('Afficher le solde')}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              {visible ? <Eye className="h-3.5 w-3.5 text-white/90" /> : <EyeOff className="h-3.5 w-3.5 text-white/90" />}
            </button>
          </div>
        </div>

        <div>
          {/* chip */}
          <div aria-hidden="true" className="mb-3 h-7 w-10 rounded-md border border-amber-200/60 bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 opacity-90 shadow-inner">
            <div className="mx-auto mt-[9px] h-px w-7 bg-amber-700/40" />
            <div className="mx-auto mt-1.5 h-px w-7 bg-amber-700/40" />
          </div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">{tr('Solde disponible')}</p>
          {loading ? (
            <Skeleton className="h-9 w-44 rounded-lg bg-white/20" />
          ) : (
            <p className="text-[2rem] font-bold leading-none tracking-tight tabular-nums drop-shadow-sm">
              {visible ? `${balance.toLocaleString(LOCALE_TAG)} HTG` : '••••• HTG'}
            </p>
          )}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/60">{tr('Titulaire')}</p>
            <p className="truncate text-[13px] font-semibold uppercase tracking-wider text-white/95">{holder}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/60">{tr('N° Compte')}</p>
            <p className="font-mono text-[11px] font-semibold tracking-widest text-white/85">{cardNumber}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

import { Eye, EyeOff, Wifi } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { tr, LOCALE_TAG } from '@/lib/i18n'

/**
 * Wallet card, glassmorphism in the platform colours (orange and white).
 * A stage (orange-to-burnt gradient) holds a bright circle and a rounded square that stick out of a really transparent
 * glass card: where they pass behind the card they are blurred, elsewhere they stay sharp. Same look in light and dark.
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
      className="relative isolate overflow-hidden rounded-[32px] px-5 py-6"
      style={{
        background: 'linear-gradient(180deg, #d4491c 0%, #8e2a0d 48%, #2b130b 100%)',
        boxShadow: '0 20px 40px -18px rgba(142, 42, 13, 0.7), 0 6px 16px -8px rgba(0, 0, 0, 0.35)',
      }}
    >
      {/* shapes behind the glass */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-6 top-3 -z-10 h-32 w-32 rounded-full bg-[#F05A28]" style={{ boxShadow: '0 10px 30px rgba(240,90,40,0.45)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-8 -right-6 -z-10 h-32 w-32 rotate-[28deg] rounded-[28px] bg-[#ffb48f]" style={{ boxShadow: '0 10px 30px rgba(255,180,143,0.35)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute right-8 top-1 -z-10 h-4 w-4 rounded-full bg-[#ffffff] opacity-90" />

      {/* the transparent glass card */}
      <div
        className="relative overflow-hidden rounded-3xl border border-white/30 text-white backdrop-blur-[18px]"
        style={{
          aspectRatio: '1.586',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.07) 55%, rgba(255,255,255,0.12) 100%)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.35) inset, 0 12px 32px rgba(0,0,0,0.28)',
        }}
      >
        <div aria-hidden="true" className="wallet-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-between p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              {/* chip + contactless */}
              <div aria-hidden="true" className="h-7 w-9 rounded-md border border-white/60 bg-white/25 shadow-inner">
                <div className="mx-auto mt-2 h-3 w-4 rounded-sm border border-white/60" />
              </div>
              <Wifi className="h-5 w-5 rotate-90 text-white/85" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-[0.18em]">KONVWA</span>
              <span className="rounded-md bg-[#F05A28] px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-white shadow-sm">PAY</span>
              <button
                type="button"
                onClick={onToggle}
                aria-label={visible ? tr('Masquer le solde') : tr('Afficher le solde')}
                className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-white/15 transition-colors hover:bg-white/30"
              >
                {visible ? <Eye className="h-3.5 w-3.5 text-white" /> : <EyeOff className="h-3.5 w-3.5 text-white" />}
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">{tr('Solde disponible')}</p>
            {loading ? (
              <Skeleton className="h-9 w-44 rounded-lg bg-white/25" />
            ) : (
              <p className="text-[1.9rem] font-bold leading-none tracking-wide tabular-nums">
                {visible ? `${balance.toLocaleString(LOCALE_TAG)} HTG` : '••••• HTG'}
              </p>
            )}
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/75">{tr('Titulaire')}</p>
              <p className="truncate text-[12px] font-semibold uppercase tracking-normal">{holder}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/75">{tr('N° Compte')}</p>
              <p className="font-mono text-[10px] font-semibold tracking-wider text-white/95">{cardNumber}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

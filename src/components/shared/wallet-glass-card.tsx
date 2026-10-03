import { Eye, EyeOff, Wifi } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { tr, LOCALE_TAG } from '@/lib/i18n'

/**
 * Wallet card, glassmorphism in the platform colours only (orange and white): a translucent orange glass that lets the page
 * show through (backdrop blur), lifted from the background by layered shadows and a soft orange/white glow around it.
 * Same look in light and dark.
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
    <div className="relative isolate">
      {/* glow behind the glass: this is what makes the card look lifted and gives the blur something to blur */}
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-6 -right-4 -z-10 h-40 w-40 rounded-full bg-[#F05A28] opacity-60 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-4 -top-6 -z-10 h-32 w-32 rounded-full bg-[#FF8A5C] opacity-50 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/3 top-1/3 -z-10 h-28 w-28 rounded-full bg-[#ffffff] opacity-70 blur-2xl" />

      <div
        className="relative overflow-hidden rounded-[28px] border border-white/60 text-white backdrop-blur-xl"
        style={{
          aspectRatio: '1.586',
          background: 'linear-gradient(135deg, rgba(240,90,40,0.88) 0%, rgba(240,90,40,0.66) 55%, rgba(255,138,92,0.55) 100%)',
          boxShadow: [
            '0 1px 0 rgba(255,255,255,0.7) inset',
            '0 -1px 0 rgba(255,255,255,0.15) inset',
            '0 2px 4px rgba(240,90,40,0.25)',
            '0 12px 24px -6px rgba(240,90,40,0.45)',
            '0 28px 48px -16px rgba(120,40,10,0.35)',
          ].join(', '),
        }}
      >
        {/* top-left sheen and a slow light sweep */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.08) 38%, rgba(255,255,255,0) 60%)' }} />
        <div aria-hidden="true" className="wallet-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-between p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-[0.2em] [text-shadow:0_1px_2px_rgba(120,40,10,0.35)]">KONVWA</span>
              <span className="rounded-md border border-white/70 bg-[#ffffff] px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-[#F05A28] shadow-sm">PAY</span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 rotate-90 text-white/90" aria-hidden="true" />
              <button
                type="button"
                onClick={onToggle}
                aria-label={visible ? tr('Masquer le solde') : tr('Afficher le solde')}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/50 bg-white/25 backdrop-blur-sm transition-colors hover:bg-white/40"
              >
                {visible ? <Eye className="h-3.5 w-3.5 text-white" /> : <EyeOff className="h-3.5 w-3.5 text-white" />}
              </button>
            </div>
          </div>

          <div>
            <div aria-hidden="true" className="mb-3 h-7 w-10 rounded-md border border-white/80 bg-gradient-to-br from-[#ffffff] via-orange-100 to-orange-200 shadow-[0_2px_6px_rgba(120,40,10,0.3)]">
              <div className="mx-auto mt-[9px] h-px w-7 bg-[#F05A28]/40" />
              <div className="mx-auto mt-1.5 h-px w-7 bg-[#F05A28]/40" />
            </div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">{tr('Solde disponible')}</p>
            {loading ? (
              <Skeleton className="h-9 w-44 rounded-lg bg-white/30" />
            ) : (
              <p className="text-[2rem] font-bold leading-none tracking-tight tabular-nums [text-shadow:0_2px_6px_rgba(120,40,10,0.35)]">
                {visible ? `${balance.toLocaleString(LOCALE_TAG)} HTG` : '••••• HTG'}
              </p>
            )}
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/75">{tr('Titulaire')}</p>
              <p className="truncate text-[13px] font-semibold uppercase tracking-wider text-white">{holder}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/75">{tr('N° Compte')}</p>
              <p className="font-mono text-[11px] font-semibold tracking-widest text-white/95">{cardNumber}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

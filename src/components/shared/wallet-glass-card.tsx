import { Eye, EyeOff, Wifi } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { tr, LOCALE_TAG } from '@/lib/i18n'

/**
 * Wallet card: a transparent frosted-glass card, nothing behind it. Orange and white only: a faint orange tint and sheen
 * inside the glass, an orange hairline border, and layered shadows to lift it from the page. Text follows the theme
 * (dark on the light page, white on the dark page).
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
      className="relative overflow-hidden rounded-3xl border border-[#F05A28]/30 text-foreground backdrop-blur-xl dark:border-white/25"
      style={{
        aspectRatio: '1.586',
        boxShadow: [
          '0 1px 0 rgba(255,255,255,0.7) inset',
          '0 2px 6px rgba(240,90,40,0.12)',
          '0 14px 28px -8px rgba(240,90,40,0.28)',
          '0 30px 50px -22px rgba(0,0,0,0.30)',
        ].join(', '),
      }}
    >
      {/* the glass itself: faint orange tint + white sheen (theme aware) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(240,90,40,0.16)_0%,rgba(255,255,255,0.35)_50%,rgba(240,90,40,0.10)_100%)] dark:bg-[linear-gradient(135deg,rgba(240,90,40,0.22)_0%,rgba(255,255,255,0.08)_50%,rgba(240,90,40,0.12)_100%)]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#F05A28] opacity-25 blur-3xl" />
      <div aria-hidden="true" className="wallet-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[#ffffff]/50 to-transparent" />

      <div className="absolute inset-0 flex flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div aria-hidden="true" className="h-7 w-9 rounded-md border border-[#F05A28]/50 bg-[#F05A28]/15 shadow-inner">
              <div className="mx-auto mt-2 h-3 w-4 rounded-sm border border-[#F05A28]/60" />
            </div>
            <Wifi className="h-5 w-5 rotate-90 text-[#F05A28]" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-[0.18em]">KONVWA</span>
            <span className="rounded-md bg-[#F05A28] px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-white shadow-sm">PAY</span>
            <button
              type="button"
              onClick={onToggle}
              aria-label={visible ? tr('Masquer le solde') : tr('Afficher le solde')}
              className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-[#F05A28]/40 bg-[#F05A28]/10 text-[#F05A28] transition-colors hover:bg-[#F05A28]/20"
            >
              {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{tr('Solde disponible')}</p>
          {loading ? (
            <Skeleton className="h-9 w-44 rounded-lg" />
          ) : (
            <p className="text-[1.9rem] font-bold leading-none tracking-wide tabular-nums">
              {visible ? `${balance.toLocaleString(LOCALE_TAG)} HTG` : '••••• HTG'}
            </p>
          )}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{tr('Titulaire')}</p>
            <p className="truncate text-[12px] font-semibold uppercase">{holder}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{tr('N° Compte')}</p>
            <p className="font-mono text-[10px] font-semibold tracking-wider">{cardNumber}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

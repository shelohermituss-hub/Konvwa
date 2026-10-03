import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'
import { useStepUp } from '@/lib/step-up'
interface PaymentSummary {
  success: boolean
  status: string
  quote: number
  due_at: string | null
  late_days: number
  late_fee: number
  late_fee_per_day: number
  deposit_pct: number
  deposit: number
  full_due: number
  deposit_due: number
  balance_after_deposit: number
  paid: number
  balance_remaining: number
}

const BTN = { background: 'linear-gradient(135deg, #F05A28, #D44E21)' }
const htg = (n: number) => `${Math.round(n).toLocaleString(LOCALE_TAG)} HTG`

function useSummary(requestId: string, refreshKey: string) {
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  useEffect(() => {
    let active = true
    supabase.rpc('shipping_payment_summary', { p_request_id: requestId }).then(({ data }) => {
      if (active && data?.success) setSummary(data as PaymentSummary)
    })
    return () => { active = false }
  }, [requestId, refreshKey])
  return summary
}

function PayButton({ loading, disabled, onClick, children }: {
  loading: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
      style={BTN}
    >
      {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{tr('Paiement en cours…')}</> : children}
    </button>
  )
}

function RechargeLink() {
  return (
    <Link
      to="/wallet"
      className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
      style={BTN}
    >
      <Wallet className="h-4 w-4" />
      {tr('Recharger — solde insuffisant')}
    </Link>
  )
}

// ── Official quote: pay in full or pay a deposit now ─────────────────────────
export function ShippingQuotePanel({ requestId, walletBalance, onPaid }: {
  requestId: string
  walletBalance: number
  onPaid: () => void
}) {
  const { confirmPayment } = useStepUp()
  const [refresh, setRefresh] = useState(0)
  const summary = useSummary(requestId, String(refresh))
  const [plan, setPlan] = useState<'full' | 'half'>('full')
  const [paying, setPaying] = useState(false)

  if (!summary) {
    return <div className="h-48 animate-pulse rounded-2xl border border-primary/20 bg-primary/5" />
  }

  const late = summary.late_days > 0
  const due = summary.due_at ? new Date(summary.due_at) : null
  const daysLeft = due ? Math.max(Math.ceil((due.getTime() - Date.now()) / 86_400_000), 0) : null
  const amount = plan === 'half' ? summary.deposit_due : summary.full_due
  const canPay = walletBalance >= amount

  async function pay() {
    if (!(await confirmPayment(amount))) return
    setPaying(true)
    const { data, error } = await supabase.rpc('pay_shipping_quote', { p_request_id: requestId, p_plan: plan })
    setPaying(false)
    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? tr('Erreur de paiement'))
      setRefresh(r => r + 1)
      return
    }
    toast.success(
      plan === 'half'
        ? tr('Acompte de {0} reçu — il reste {1} à la livraison', htg(data.charged), htg(data.balance_remaining))
        : tr('{0} débités — paiement confirmé', htg(data.charged)),
    )
    onPaid()
  }

  const options = [
    {
      key: 'full' as const,
      title: tr('Payer en totalité'),
      amount: summary.full_due,
      note: tr('Aucun montant à régler à la livraison.'),
    },
    {
      key: 'half' as const,
      title: tr('Payer {0}% maintenant', summary.deposit_pct),
      amount: summary.deposit_due,
      note: tr('Le reste ({0}) est à régler à la livraison.', htg(summary.balance_after_deposit)),
    },
  ]

  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <p className="font-bold text-foreground">{tr('Devis officiel')}</p>
        <p className="text-xl font-bold text-primary">{htg(summary.quote)}</p>
      </div>

      {late ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="text-sm leading-relaxed text-red-800">
            <p className="font-bold">
              {tr('En retard de')}{' '}{summary.late_days}{' '}{tr('jour')}{summary.late_days > 1 ? 's' : ''} — {htg(summary.late_fee)}{' '}{tr('de frais ajoutés')}
            </p>
            <p className="text-red-700/90">
              {htg(summary.late_fee_per_day)}{' '}{tr('de plus chaque jour tant que le devis n\'est pas réglé.')}
            </p>
          </div>
        </div>
      ) : due && (
        <div className={cn(
          'flex items-start gap-2.5 rounded-xl border px-3.5 py-3',
          daysLeft !== null && daysLeft <= 2 ? 'border-amber-300 bg-amber-50' : 'border-primary/20 bg-white',
        )}>
          <CalendarClock className={cn('mt-0.5 h-4 w-4 shrink-0', daysLeft !== null && daysLeft <= 2 ? 'text-amber-600' : 'text-primary')} />
          <div className="text-sm leading-relaxed text-foreground">
            <p className="font-semibold">
              {tr('À régler avant le')}{' '}{due.toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })}
              {daysLeft !== null && tr(' · {0} jour{1} restant{2}', daysLeft, daysLeft > 1 ? 's' : '', daysLeft > 1 ? 's' : '')}
            </p>
            <p className="text-muted-foreground">
              {tr('Passé ce délai,')}{' '}{htg(summary.late_fee_per_day)}{' '}{tr('de frais de retard s\'ajoutent chaque jour.')}
            </p>
          </div>
        </div>
      )}

      {late && (
        <div className="space-y-1 rounded-xl bg-white px-3.5 py-2.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{tr('Devis')}</span><span className="font-semibold">{htg(summary.quote)}</span></div>
          <div className="flex justify-between"><span className="text-red-600">{tr('Frais de retard')}</span><span className="font-semibold text-red-600">+ {htg(summary.late_fee)}</span></div>
          <div className="flex justify-between border-t border-border/50 pt-1"><span className="font-bold">{tr('Total')}</span><span className="font-bold">{htg(summary.full_due)}</span></div>
        </div>
      )}

      <div role="radiogroup" aria-label={tr('Mode de paiement')} className="space-y-2">
        {options.map(o => {
          const selected = plan === o.key
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPlan(o.key)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border bg-white p-3.5 text-left transition-all active:scale-[0.99]',
                selected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-primary/40',
              )}
            >
              <span className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                selected ? 'border-primary bg-primary' : 'border-gray-300',
              )}>
                {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-foreground">{o.title}</span>
                  <span className="shrink-0 text-sm font-bold text-primary">{htg(o.amount)}</span>
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{o.note}</span>
              </span>
            </button>
          )
        })}
      </div>

      {late && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {tr('Les')}{' '}{htg(summary.late_fee)}{' '}{tr('de frais de retard sont inclus dans le premier paiement, quel que soit le mode choisi.')}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {tr('Solde du portefeuille :')}{' '}<span className="font-semibold text-foreground">{htg(walletBalance)}</span>
      </p>

      {canPay ? (
        <PayButton loading={paying} onClick={pay}>
          <Wallet className="h-4 w-4" />{tr('Payer')}{' '}{htg(amount)}
        </PayButton>
      ) : (
        <RechargeLink />
      )}
    </div>
  )
}

// ── Deposit paid: remaining balance due at delivery ──────────────────────────
export function ShippingBalancePanel({ requestId, walletBalance, onPaid }: {
  requestId: string
  walletBalance: number
  onPaid: () => void
}) {
  const { confirmPayment } = useStepUp()
  const summary = useSummary(requestId, 'balance')
  const [paying, setPaying] = useState(false)

  if (!summary) {
    return <div className="h-36 animate-pulse rounded-2xl border border-emerald-200 bg-emerald-50/60" />
  }

  const rest = summary.balance_remaining
  const canPay = walletBalance >= rest

  async function pay() {
    if (!(await confirmPayment(rest))) return
    setPaying(true)
    const { data, error } = await supabase.rpc('pay_shipping_balance', { p_request_id: requestId })
    setPaying(false)
    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? tr('Erreur de paiement'))
      return
    }
    toast.success(tr('{0} débités — expédition entièrement payée', htg(data.charged)))
    onPaid()
  }

  return (
    <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <p className="text-sm font-medium leading-relaxed text-emerald-900">
          {tr('Acompte reçu :')}{' '}<span className="font-bold">{htg(summary.paid)}</span>
          {summary.late_fee > 0 && tr(' (+ {0} de frais de retard)', htg(summary.late_fee))}{tr('. Votre cargaison sera assignée à une prochaine expédition.')}
        </p>
      </div>

      <div className="space-y-1 rounded-xl bg-white px-3.5 py-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">{tr('Devis')}</span><span className="font-semibold">{htg(summary.quote)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">{tr('Déjà payé')}</span><span className="font-semibold text-emerald-600">− {htg(summary.paid)}</span></div>
        <div className="flex justify-between border-t border-border/50 pt-1">
          <span className="font-bold">{tr('Reste à payer à la livraison')}</span>
          <span className="font-bold text-primary">{htg(rest)}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {tr('Vous pouvez régler ce solde dès maintenant depuis votre portefeuille (')}{htg(walletBalance)}{' '}{tr('disponibles), ou le remettre à la livraison.')}
      </p>

      {canPay ? (
        <PayButton loading={paying} onClick={pay}>
          <Wallet className="h-4 w-4" />{tr('Payer le solde maintenant —')}{' '}{htg(rest)}
        </PayButton>
      ) : (
        <RechargeLink />
      )}
    </div>
  )
}

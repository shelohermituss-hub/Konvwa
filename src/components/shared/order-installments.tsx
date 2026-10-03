import { useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { installmentAmounts, INSTALLMENT_GAP_DAYS } from '@/lib/installments'
import { useStepUp } from '@/lib/step-up'
import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'

const htg = (n: number) => `${n.toLocaleString(LOCALE_TAG)} HTG`

/** "Pay in 2 or 3 times" choice shown next to the pay button. */
export function InstallmentOptions({ orderId, total, balance, onChanged }: {
  orderId: string
  total: number
  balance: number
  onChanged: () => void
}) {
  const { confirmPayment } = useStepUp()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    void supabase.from('app_settings').select('key, value').in('key', ['installments_enabled', 'installments_min_total_htg']).then(({ data }) => {
      const v = Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value as string]))
      setEnabled(v.installments_enabled !== 'false' && total >= Number(v.installments_min_total_htg ?? 20000))
    })
  }, [total])

  if (!enabled) return null

  async function start(count: 2 | 3) {
    const first = installmentAmounts(total, count)[0]
    if (balance < first) { toast.error(tr('Solde insuffisant. Veuillez recharger votre portefeuille.')); return }
    if (!(await confirmPayment(first))) return
    setBusy(count)
    const { data, error } = await supabase.rpc('start_installments', { p_order_id: orderId, p_count: count })
    setBusy(null)
    const r = data as { success?: boolean; error?: string } | null
    if (error || !r?.success) { toast.error(r?.error ?? tr('Erreur lors du paiement. Réessayez.')); return }
    toast.success(tr('Premier versement payé. Votre commande est lancée.'))
    onChanged()
  }

  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />{tr('Ou payez en plusieurs fois, sans frais')}
      </p>
      {([2, 3] as const).map((count) => {
        const amounts = installmentAmounts(total, count)
        const disabled = busy !== null
        return (
          <button
            key={count}
            type="button"
            onClick={() => void start(count)}
            disabled={disabled}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 px-3.5 py-3 text-left transition-colors hover:border-primary/50 disabled:opacity-60"
          >
            <span>
              <span className="block text-sm font-bold">{tr('En {0} fois', count)}</span>
              <span className="block text-xs text-muted-foreground">{amounts.map(htg).join(' · ')} — {tr('tous les {0} jours', INSTALLMENT_GAP_DAYS)}</span>
            </span>
            {busy === count ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="shrink-0 text-xs font-bold text-primary">{tr('Payer {0}', htg(amounts[0]))}</span>}
          </button>
        )
      })}
      <p className="text-[11px] text-muted-foreground">{tr('Votre commande est lancée dès le premier versement. L\'expédition vers Haïti part quand tout est payé.')}</p>
    </div>
  )
}

interface Row { id: string; seq: number; amount_htg: number; due_at: string; paid_at: string | null }

/** Schedule of an order paid in installments, with the button for the next one. */
export function InstallmentSchedule({ orderId, balance, refreshKey, onChanged }: {
  orderId: string
  balance: number
  refreshKey: number
  onChanged: () => void
}) {
  const { confirmPayment } = useStepUp()
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void supabase.from('order_installments').select('id, seq, amount_htg, due_at, paid_at').eq('order_id', orderId).order('seq')
      .then(({ data }) => { if (!cancelled) setRows((data ?? []) as Row[]) })
    return () => { cancelled = true }
  }, [orderId, refreshKey])

  if (rows.length === 0) return null
  const next = rows.find((r) => !r.paid_at)

  async function payNext() {
    if (!next) return
    if (balance < next.amount_htg) { toast.error(tr('Solde insuffisant. Veuillez recharger votre portefeuille.')); return }
    if (!(await confirmPayment(next.amount_htg))) return
    setBusy(true)
    const { data, error } = await supabase.rpc('pay_next_installment', { p_order_id: orderId })
    setBusy(false)
    const r = data as { success?: boolean; error?: string; remaining?: number } | null
    if (error || !r?.success) { toast.error(r?.error ?? tr('Erreur lors du paiement. Réessayez.')); return }
    toast.success(r.remaining === 0 ? tr('Commande entièrement payée. Merci !') : tr('Versement payé.'))
    onChanged()
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-bold">{tr('Paiement en plusieurs fois')}</p>
      <ol className="space-y-2">
        {rows.map((r) => {
          const late = !r.paid_at && new Date(r.due_at) < new Date()
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                {r.paid_at ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> : <CalendarClock className={late ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-muted-foreground'} aria-hidden />}
                <span className="font-medium">{tr('Versement {0}', r.seq)}</span>
              </span>
              <span className="text-right">
                <span className="block font-semibold tabular-nums">{htg(r.amount_htg)}</span>
                <span className={`block text-xs ${late ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                  {r.paid_at
                    ? tr('Payé le {0}', new Date(r.paid_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' }))
                    : `${late ? tr('En retard · ') : tr('Avant le ')}${new Date(r.due_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' })}`}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      {next && (
        <Button onClick={() => void payNext()} disabled={busy} className="mt-4 h-11 w-full gap-2 rounded-xl font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}{tr('Payer le versement {0}', next.seq)} · {htg(next.amount_htg)}
        </Button>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Scale } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { verifyPayment } from '@/lib/payment-api'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'

interface WalletLine { user_id: string; full_name: string | null; balance: number; computed: number; diff: number }
interface StaleDeposit { id: string; amount: number; method: string | null; reference: string | null; created_at: string }
interface Report { wallets: WalletLine[]; stale_deposits: StaleDeposit[] }

const htg = (n: number) => `${n.toLocaleString(LOCALE_TAG)} HTG`

export function AdminReconciliationPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(false)
    const { data, error: rpcError } = await supabase.rpc('admin_ledger_report')
    if (rpcError || !data) { setError(true); return }
    setReport(data as Report)
  }, [])

  useEffect(() => { void load() }, [load])

  async function check(d: StaleDeposit) {
    if (!d.reference) { toast.error(tr('Ce dépôt n\'a pas de référence à vérifier (preuve manuelle).')); return }
    setBusyId(d.id)
    try {
      const result = await verifyPayment(d.reference)
      toast.success(result.verified ? tr('Paiement confirmé et portefeuille crédité.') : tr('Pas encore payé chez le fournisseur.'))
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Vérification impossible.'))
    } finally {
      setBusyId(null)
    }
  }

  const mismatches = report?.wallets.filter((w) => Math.abs(w.diff) > 0.005) ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr('Rapprochement')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {tr('Compare le solde de chaque portefeuille avec la somme de ses transactions validées, et repère les dépôts restés en attente.')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5 rounded-xl">
          <RefreshCw className="h-3.5 w-3.5" />{tr('Actualiser')}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive">{tr('Impossible de charger le rapport.')}</div>
      ) : !report ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : (
        <>
          <div className={cn('flex items-center gap-3 rounded-2xl border p-4', mismatches.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50')}>
            {mismatches.length ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-700" />}
            <p className="text-sm font-semibold">
              {mismatches.length
                ? tr('{0} portefeuille(s) avec un écart entre le solde et les transactions.', mismatches.length)
                : tr('Tous les soldes correspondent aux transactions.')}
            </p>
          </div>

          <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <h2 className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 text-sm font-semibold"><Scale className="h-4 w-4" />{tr('Portefeuilles')}</h2>
            <ul className="divide-y divide-gray-100">
              {report.wallets.map((w) => (
                <li key={w.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{w.full_name ?? w.user_id.slice(0, 8)}</span>
                  <span className="flex items-center gap-4 tabular-nums">
                    <span className="text-muted-foreground">{tr('Solde')} {htg(w.balance)}</span>
                    <span className="text-muted-foreground">{tr('Transactions')} {htg(w.computed)}</span>
                    <span className={cn('min-w-24 text-right font-semibold', Math.abs(w.diff) > 0.005 ? 'text-amber-700' : 'text-emerald-700')}>
                      {Math.abs(w.diff) > 0.005 ? `${w.diff > 0 ? '+' : ''}${htg(w.diff)}` : tr('OK')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-gray-100 px-4 py-3 text-xs text-muted-foreground">
              {tr('Un écart peut venir d\'un ajustement manuel ou de données de test : vérifiez l\'historique dans le journal d\'audit avant toute correction.')}
            </p>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold">{tr('Dépôts en attente depuis plus de 24 h')}</h2>
            {report.stale_deposits.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">{tr('Aucun dépôt en retard.')}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {report.stale_deposits.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span>
                      <span className="font-semibold tabular-nums">{htg(d.amount)}</span>{' '}
                      <span className="text-xs capitalize text-muted-foreground">{d.method ?? '—'}</span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleString(DATE_LOCALE, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {d.reference ? ` · ${d.reference}` : ''}
                      </span>
                    </span>
                    {(d.method === 'moncash' || d.method === 'natcash') && (
                      <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => void check(d)} className="gap-1.5 rounded-xl">
                        {busyId === d.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{tr('Vérifier chez le fournisseur')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'

interface Insights {
  revenue_30d: number
  revenue_prev_30d: number
  orders_30d: number
  margin_30d: number
  quote_conversion: { quoted: number; paid: number }
  pending_deposits: { count: number; amount: number }
  kyc_pending: number
  open_tickets: number
  wallet_total: number
  stuck_orders: Array<{ id: string; tracking_code: string; status: string; updated_at: string }>
}

const htg = (n: number) => `${Math.round(n).toLocaleString(LOCALE_TAG)} HTG`

function Kpi({ label, value, hint, to, tone }: { label: string; value: string; hint?: React.ReactNode; to?: string; tone?: 'warn' }) {
  const body = (
    <div className={cn('h-full rounded-2xl border bg-white p-4 shadow-sm', tone === 'warn' ? 'border-amber-200' : 'border-gray-100', to && 'transition-colors hover:border-primary/40')}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums', tone === 'warn' && 'text-amber-700')}>{value}</p>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export function AdminInsightsPage() {
  const [data, setData] = useState<Insights | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    const { data: res, error: rpcError } = await supabase.rpc('admin_insights')
    if (rpcError || !res) { setError(true); return }
    setData(res as Insights)
  }, [])

  useEffect(() => { void load() }, [load])

  const delta = data && data.revenue_prev_30d > 0 ? ((data.revenue_30d - data.revenue_prev_30d) / data.revenue_prev_30d) * 100 : null
  const conversion = data && data.quote_conversion.quoted > 0 ? Math.round((data.quote_conversion.paid / data.quote_conversion.quoted) * 100) : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr('Pilotage')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{tr('Les chiffres clés des 30 derniers jours et ce qui demande votre attention.')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5 rounded-xl"><RefreshCw className="h-3.5 w-3.5" />{tr('Actualiser')}</Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive">{tr('Impossible de charger les chiffres.')}</div>
      ) : !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label={tr('Chiffre d\'affaires (30 j)')}
              value={htg(data.revenue_30d)}
              hint={delta == null ? tr('Pas de période précédente') : (
                <span className={cn('inline-flex items-center gap-0.5 font-semibold', delta >= 0 ? 'text-emerald-700' : 'text-destructive')}>
                  {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(Math.round(delta))} % {tr('vs 30 j précédents')}
                </span>
              )}
            />
            <Kpi label={tr('Marge des commandes payées (30 j)')} value={htg(data.margin_30d)} />
            <Kpi label={tr('Commandes (30 j)')} value={String(data.orders_30d)} to="/admin/orders" />
            <Kpi
              label={tr('Conversion devis → paiement (90 j)')}
              value={conversion == null ? '—' : `${conversion} %`}
              hint={tr('{0} payés sur {1} devis', data.quote_conversion.paid, data.quote_conversion.quoted)}
            />
            <Kpi label={tr('Dépôts en attente')} value={htg(data.pending_deposits.amount)} hint={tr('{0} dépôt(s)', data.pending_deposits.count)} to="/admin/payments" tone={data.pending_deposits.count > 0 ? 'warn' : undefined} />
            <Kpi label={tr('Identités à vérifier')} value={String(data.kyc_pending)} to="/admin/kyc" tone={data.kyc_pending > 0 ? 'warn' : undefined} />
            <Kpi label={tr('Demandes de support ouvertes')} value={String(data.open_tickets)} to="/admin/disputes" tone={data.open_tickets > 0 ? 'warn' : undefined} />
            <Kpi label={tr('Soldes clients (engagement)')} value={htg(data.wallet_total)} hint={tr('Somme des portefeuilles')} to="/admin/reconciliation" />
          </div>

          <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <h2 className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-500" />{tr('Commandes sans mouvement depuis plus de 7 jours')}
            </h2>
            {data.stuck_orders.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">{tr('Aucune commande bloquée.')}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.stuck_orders.map((o) => (
                  <li key={o.id}>
                    <Link to="/admin/orders" className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted/30">
                      <span className="font-mono font-semibold">{o.tracking_code}</span>
                      <span className="flex items-center gap-3">
                        <StatusBadge status={o.status} />
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />{new Date(o.updated_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' })}
                        </span>
                      </span>
                    </Link>
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

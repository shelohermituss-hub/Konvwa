import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackageCheck, Ship } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrivalDialog, type ArrivalTarget } from '@/components/shared/arrival-dialog'
import { AssignBatchDialog, type AssignTarget } from '@/components/shared/assign-batch-dialog'
import { supabase } from '@/lib/supabase'
import { shipmentStatusLabel } from '@/lib/cargo-tracking'
import { IN_TRANSIT, productOrderLabel, trackingStatusOf } from '@/lib/product-order'
import { cn } from '@/lib/utils'
import { tr, trServer, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'

interface Row {
  id: string; tracking_code: string; user_id: string; status: string; payment_status: string; tracking_status: string | null
  total_htg: number; created_at: string; shipping_paid_at: string | null
  shipping_amount_htg: number | null; weight_kg: number | null; cbm: number | null
  customer: string | null
  product_order_items: Array<{ product_name: string; quantity: number }>
}

const FILTERS: Array<{ key: string; label: () => string; value: (t: string) => boolean }> = [
  { key: 'buy', label: () => tr('Payé / achat'), value: (t) => t === 'paid' || t === 'purchasing' },
  { key: 'warehouse', label: () => tr('À l\'entrepôt'), value: (t) => t === 'in_china_warehouse' },
  { key: 'paidship', label: () => tr('Expédition payée'), value: (t) => t === 'shipping_paid' },
  { key: 'route', label: () => tr('En route'), value: (t) => IN_TRANSIT.includes(t) },
  { key: 'done', label: () => tr('Livrées'), value: (t) => t === 'delivered' },
  { key: 'all', label: () => tr('Toutes'), value: () => true },
]

/**
 * Catalogue orders: same journey as every order, starting at "Payé". When the parcel is available at the warehouse the team
 * enters the real measures; the customer then chooses a shipping method and pays, which creates a paid shipping request
 * linked to the order. The cargo status is then managed from the shipping request, and the order follows.
 */
export function AdminProductOrdersPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('buy')
  const [arriving, setArriving] = useState<ArrivalTarget | null>(null)
  const [assigning, setAssigning] = useState<AssignTarget | null>(null)

  const load = useCallback(async () => {
    const o = await supabase.from('product_orders')
      .select('id, tracking_code, user_id, status, payment_status, tracking_status, total_htg, created_at, shipping_paid_at, shipping_amount_htg, weight_kg, cbm, product_order_items(product_name, quantity)')
      .eq('payment_status', 'paid').order('created_at', { ascending: false }).limit(200)
    const list = (o.data ?? []) as unknown as Array<Omit<Row, 'customer'>>
    const ids = Array.from(new Set(list.map((r) => r.user_id)))
    const { data: profs } = ids.length ? await supabase.from('profiles').select('user_id, full_name').in('user_id', ids) : { data: [] }
    const names = new Map((profs ?? []).map((p) => [p.user_id as string, p.full_name as string | null]))
    setRows(list.map((r) => ({ ...r, customer: names.get(r.user_id) ?? null })))
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]
  const shown = useMemo(() => rows.filter((r) => active.value(trackingStatusOf(r))), [rows, active])

  async function setStatus(r: Row, status: string) {
    const { data, error } = await supabase.rpc('admin_set_product_order_status', { p_id: r.id, p_status: status })
    if (error || !data?.success) { toast.error(trServer((data?.error as string | undefined) ?? error?.message ?? 'Erreur')); return }
    void load()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><PackageCheck className="h-6 w-6" />{tr('Commandes catalogue')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{tr('Même parcours que les autres commandes, à partir de « Payé ». Quand le colis est à l\'entrepôt, saisissez les mesures réelles : le client choisit son expédition (frais calculés) et paie. Après le paiement de l\'expédition, assignez la commande à une expédition (lot) : elle en suit le statut.')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors', filter === f.key ? 'border-primary bg-primary text-white' : 'border-border bg-white text-muted-foreground hover:bg-muted/50')}>
            {f.label()}
          </button>
        ))}
      </div>

      {loading ? <Skeleton className="h-40 rounded-2xl" /> : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{tr('Aucune commande dans cette étape.')}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const t = trackingStatusOf(r)
            return (
              <li key={r.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{r.customer ?? '—'} <span className="font-mono text-xs text-muted-foreground">#{r.tracking_code}</span></p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.product_order_items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ') || '—'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })} · {r.total_htg.toLocaleString(LOCALE_TAG)} HTG
                      {(r.weight_kg || r.cbm) && ` · ${[r.weight_kg ? `${r.weight_kg} kg` : '', r.cbm ? `${r.cbm} CBM` : ''].filter(Boolean).join(' / ')}`}
                      {r.shipping_amount_htg != null && ` · ${tr('expédition')} ${r.shipping_amount_htg.toLocaleString(LOCALE_TAG)} HTG`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">{productOrderLabel(r)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {t === 'paid' && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void setStatus(r, 'purchasing')}>{tr('Achat en cours')}</Button>}
                  {t === 'purchasing' && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void setStatus(r, 'paid')}>{tr('Revenir à « Payé »')}</Button>}
                  {(t === 'paid' || t === 'purchasing' || (t === 'in_china_warehouse' && !r.shipping_paid_at)) && (
                    <Button size="sm" className="gap-1.5 rounded-lg" onClick={() => setArriving({ kind: 'product_order', id: r.id, label: `${tr('Commande catalogue')} #${r.tracking_code}`, weight_kg: r.weight_kg, cbm: r.cbm })}>
                      <PackageCheck className="h-3.5 w-3.5" />{t === 'in_china_warehouse' ? tr('Corriger les mesures') : tr('Disponible à l\'entrepôt')}
                    </Button>
                  )}
                  {r.shipping_paid_at && t !== 'delivered' && (
                    <Button size="sm" className="gap-1.5 rounded-lg" onClick={() => setAssigning({ kind: 'product_order', id: r.id, label: `${tr('Commande catalogue')} #${r.tracking_code}` })}>
                      <Ship className="h-3.5 w-3.5" />{tr('Assigner à une expédition')}
                    </Button>
                  )}
                  {r.shipping_paid_at && (
                    <select
                      aria-label={tr('Statut de la commande')}
                      value={t}
                      onChange={(e) => void setStatus(r, e.target.value)}
                      className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                    >
                      {['shipping_paid', 'shipped', 'in_transit', 'arrived_haiti', 'customs_processing', 'out_for_delivery', 'delivered'].map((st) => (
                        <option key={st} value={st}>{shipmentStatusLabel(st)}</option>
                      ))}
                    </select>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <AssignBatchDialog target={assigning} onClose={() => setAssigning(null)} onDone={() => void load()} />
      <ArrivalDialog target={arriving} onClose={() => setArriving(null)} onDone={() => void load()} />
    </div>
  )
}

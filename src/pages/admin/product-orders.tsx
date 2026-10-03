import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, PackageCheck, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { productOrderStage, productOrderStageLabel, type ProductOrderStage } from '@/lib/product-order'
import { cn } from '@/lib/utils'
import { tr, trServer, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'

interface Row {
  id: string; user_id: string; status: string; payment_status: string; total_htg: number; created_at: string
  received_at: string | null; shipping_amount_htg: number | null; shipping_paid_at: string | null
  profiles: { full_name: string | null } | null
  product_order_items: Array<{ product_name: string; quantity: number }>
}

const FILTERS: Array<{ value: ProductOrderStage | 'all'; label: () => string }> = [
  { value: 'purchasing', label: () => tr('À acheter / en route') },
  { value: 'arrived', label: () => tr('Expédition à payer') },
  { value: 'ready_to_ship', label: () => tr('À expédier') },
  { value: 'shipped', label: () => tr('Expédiées') },
  { value: 'all', label: () => tr('Toutes') },
]

/** Catalogue orders: the customer paid the purchase; the team confirms the arrival and sets the shipping fee. */
export function AdminProductOrdersPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ProductOrderStage | 'all'>('purchasing')
  const [arriving, setArriving] = useState<Row | null>(null)
  const [fee, setFee] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('product_orders')
      .select('id, user_id, status, payment_status, total_htg, created_at, received_at, shipping_amount_htg, shipping_paid_at, product_order_items(product_name, quantity)')
      .neq('payment_status', 'unpaid')
      .order('created_at', { ascending: false })
      .limit(200)
    const list = (data ?? []) as unknown as Array<Omit<Row, 'profiles'>>
    const ids = Array.from(new Set(list.map((r) => r.user_id)))
    const { data: profs } = ids.length ? await supabase.from('profiles').select('user_id, full_name').in('user_id', ids) : { data: [] }
    const names = new Map((profs ?? []).map((p) => [p.user_id as string, p.full_name as string | null]))
    setRows(list.map((r) => ({ ...r, profiles: { full_name: names.get(r.user_id) ?? null } })))
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const shown = useMemo(() => rows.filter((r) => filter === 'all' || productOrderStage(r) === filter), [rows, filter])

  async function confirmArrival() {
    if (!arriving) return
    const amount = Number(fee)
    if (!Number.isFinite(amount) || amount < 0) { toast.error(tr('Montant d\'expédition invalide.')); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_product_order_received', { p_order_id: arriving.id, p_shipping_htg: amount, p_note: note || null })
    setBusy(false)
    if (error || !data?.success) { toast.error(trServer(data?.error ?? error?.message ?? 'Erreur')); return }
    toast.success(tr('Colis marqué comme arrivé : le client est prévenu.'))
    setArriving(null); setFee(''); setNote('')
    void load()
  }

  async function setStatus(row: Row, status: 'shipped' | 'delivered') {
    const { error } = await supabase.from('product_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', row.id)
    if (error) { toast.error(trServer(error.message)); return }
    toast.success(status === 'shipped' ? tr('Commande marquée comme expédiée.') : tr('Commande marquée comme livrée.'))
    void load()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><PackageCheck className="h-6 w-6" />{tr('Commandes catalogue')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{tr('Le client paie l\'achat. Quand le colis arrive, fixez les frais d\'expédition : le client est prévenu et paie avant l\'expédition.')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" onClick={() => setFilter(f.value)}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors', filter === f.value ? 'border-primary bg-primary text-white' : 'border-border bg-white text-muted-foreground hover:bg-muted/50')}>
            {f.label()}
          </button>
        ))}
      </div>

      {loading ? <Skeleton className="h-40 rounded-2xl" /> : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{tr('Aucune commande dans cette étape.')}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const stage = productOrderStage(r)
            return (
              <li key={r.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{r.profiles?.full_name ?? '—'} <span className="font-mono text-xs text-muted-foreground">#{r.id.slice(0, 8).toUpperCase()}</span></p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.product_order_items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ') || '—'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })} · {r.total_htg.toLocaleString(LOCALE_TAG)} HTG
                      {r.shipping_amount_htg != null && ` · ${tr('expédition')} ${r.shipping_amount_htg.toLocaleString(LOCALE_TAG)} HTG`}
                    </p>
                  </div>
                  <span className={cn('shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', stage === 'arrived' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-sky-200 bg-sky-50 text-sky-700')}>
                    {productOrderStageLabel(stage)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stage === 'purchasing' && (
                    <Button size="sm" className="gap-1.5 rounded-lg" onClick={() => { setArriving(r); setFee(''); setNote('') }}>
                      <PackageCheck className="h-3.5 w-3.5" />{tr('Colis arrivé')}
                    </Button>
                  )}
                  {stage === 'ready_to_ship' && (
                    <Button size="sm" className="gap-1.5 rounded-lg" onClick={() => void setStatus(r, 'shipped')}><Truck className="h-3.5 w-3.5" />{tr('Marquer expédiée')}</Button>
                  )}
                  {stage === 'shipped' && (
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void setStatus(r, 'delivered')}>{tr('Marquer livrée')}</Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={!!arriving} onOpenChange={(o) => { if (!o) setArriving(null) }}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{tr('Colis arrivé à l\'entrepôt')}</DialogTitle>
            <DialogDescription>{tr('Indiquez les frais d\'expédition à payer par le client (0 = offerte). Il sera prévenu tout de suite.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="ship-fee" className="text-sm font-semibold">{tr('Frais d\'expédition (HTG)')}</label>
              <Input id="ship-fee" type="number" min={0} inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} className="h-11 rounded-xl" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ship-note" className="text-sm font-semibold">{tr('Note pour le client (facultatif)')}</label>
              <Input id="ship-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="h-11 rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setArriving(null)}>{tr('Annuler')}</Button>
            <Button className="rounded-xl" disabled={busy || fee === ''} onClick={() => void confirmArrival()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tr('Confirmer et prévenir le client')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

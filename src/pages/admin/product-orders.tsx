import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, PackageCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { productOrderLabel, productOrderStage, type ProductOrderStage, type ShippingRequestState } from '@/lib/product-order'
import { cn } from '@/lib/utils'
import { tr, trServer, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'

interface Row {
  id: string; user_id: string; status: string; payment_status: string; total_htg: number; created_at: string
  shipping_request_id: string | null
  shipping_request: ShippingRequestState | null
  customer: string | null
  product_order_items: Array<{ product_name: string; quantity: number }>
}
interface Option { id: string; label: string }

const FILTERS: Array<{ value: (s: ProductOrderStage) => boolean; key: string; label: () => string }> = [
  { key: 'purchasing', value: (s) => s === 'purchasing', label: () => tr('À acheter / en route') },
  { key: 'shipping', value: (s) => ['awaiting_quote', 'quote_ready', 'deposit_paid'].includes(s), label: () => tr('Expédition en cours') },
  { key: 'paid', value: (s) => s === 'shipping_paid' || s === 'shipped', label: () => tr('Expédition payée') },
  { key: 'all', value: () => true, label: () => tr('Toutes') },
]

/** Catalogue orders: purchase only. On arrival the team opens a normal shipping request (same flow as every shipping request). */
export function AdminProductOrdersPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('purchasing')
  const [warehouses, setWarehouses] = useState<Option[]>([])
  const [categories, setCategories] = useState<Array<{ slug: string; name: string }>>([])
  const [arriving, setArriving] = useState<Row | null>(null)
  const [warehouseId, setWarehouseId] = useState('')
  const [category, setCategory] = useState('')
  const [packages, setPackages] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    const [o, w, c] = await Promise.all([
      supabase.from('product_orders')
        .select('id, user_id, status, payment_status, total_htg, created_at, shipping_request_id, shipping_request:product_requests(status, quoted_amount_htg, payment_plan, shipment:shipments(status)), product_order_items(product_name, quantity)')
        .neq('payment_status', 'unpaid').order('created_at', { ascending: false }).limit(200),
      supabase.from('warehouses').select('id, name, code').eq('active', true).order('sort_order'),
      supabase.from('product_rate_categories').select('slug, name').eq('active', true).order('sort_order'),
    ])
    const list = (o.data ?? []) as unknown as Array<Omit<Row, 'customer'>>
    const ids = Array.from(new Set(list.map((r) => r.user_id)))
    const { data: profs } = ids.length ? await supabase.from('profiles').select('user_id, full_name').in('user_id', ids) : { data: [] }
    const names = new Map((profs ?? []).map((p) => [p.user_id as string, p.full_name as string | null]))
    setRows(list.map((r) => ({ ...r, customer: names.get(r.user_id) ?? null })))
    setWarehouses((w.data ?? []).map((x) => ({ id: x.id as string, label: `${x.code ?? ''} ${x.name}`.trim() })))
    setCategories((c.data ?? []) as Array<{ slug: string; name: string }>)
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]
  const shown = useMemo(() => rows.filter((r) => active.value(productOrderStage(r))), [rows, active])

  function openArrival(r: Row) {
    setArriving(r); setNote(''); setPackages('')
    setWarehouseId((v) => v || warehouses[0]?.id || '')
    setCategory((v) => v || categories[0]?.slug || '')
  }

  async function confirmArrival() {
    if (!arriving || !warehouseId || !category) return
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_product_order_received', {
      p_order_id: arriving.id, p_warehouse_id: warehouseId, p_category_slug: category,
      p_package_count: packages ? Number(packages) : null, p_note: note || null,
    })
    setBusy(false)
    if (error || !data?.success) { toast.error(trServer(data?.error ?? error?.message ?? 'Erreur')); return }
    toast.success(tr('Colis disponible à l\'entrepôt : rédigez maintenant la demande d\'expédition du client.'))
    setArriving(null)
    navigate(`/admin/shipping-requests?open=${data.request_id as string}`)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><PackageCheck className="h-6 w-6" />{tr('Commandes catalogue')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{tr('Le client paie l\'achat. À l\'arrivée du colis, une demande d\'expédition est ouverte : mesures réelles, tarif et devis se font dans « Dem. expédition », comme pour toute expédition.')}</p>
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
            const stage = productOrderStage(r)
            return (
              <li key={r.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{r.customer ?? '—'} <span className="font-mono text-xs text-muted-foreground">#{r.id.slice(0, 8).toUpperCase()}</span></p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.product_order_items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ') || '—'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })} · {r.total_htg.toLocaleString(LOCALE_TAG)} HTG
                      {r.shipping_request?.quoted_amount_htg != null && ` · ${tr('expédition')} ${r.shipping_request.quoted_amount_htg.toLocaleString(LOCALE_TAG)} HTG`}
                    </p>
                  </div>
                  <span className={cn('shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', stage === 'quote_ready' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-sky-200 bg-sky-50 text-sky-700')}>
                    {productOrderLabel(r)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stage === 'purchasing' && (
                    <Button size="sm" className="gap-1.5 rounded-lg" onClick={() => openArrival(r)}><PackageCheck className="h-3.5 w-3.5" />{tr('Disponible à l\'entrepôt')}</Button>
                  )}
                  {r.shipping_request_id && ['awaiting_quote', 'quote_ready', 'deposit_paid', 'shipping_paid', 'shipped'].includes(stage) && (
                    <Button asChild size="sm" variant="outline" className="rounded-lg"><Link to={`/admin/shipping-requests?open=${r.shipping_request_id}`}>{tr('Ouvrir la demande d\'expédition')}</Link></Button>
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
            <DialogTitle>{tr('Produit disponible à l\'entrepôt')}</DialogTitle>
            <DialogDescription>{tr('La demande d\'expédition du client s\'ouvre ensuite : vous saisissez les mesures réelles, choisissez le tarif et envoyez-la au client pour qu\'il la paie.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="po-wh" className="text-sm font-semibold">{tr('Entrepôt')}</label>
              <select id="po-wh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="po-cat" className="text-sm font-semibold">{tr('Type de produits (tarif)')}</label>
              <select id="po-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                {categories.map((c) => <option key={c.slug} value={c.slug}>{tr(c.name)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="po-pk" className="text-sm font-semibold">{tr('Nombre de colis (facultatif)')}</label>
              <Input id="po-pk" type="number" min={1} inputMode="numeric" value={packages} onChange={(e) => setPackages(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="po-note" className="text-sm font-semibold">{tr('Note (facultatif)')}</label>
              <Input id="po-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="h-11 rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setArriving(null)}>{tr('Annuler')}</Button>
            <Button className="rounded-xl" disabled={busy || !warehouseId || !category} onClick={() => void confirmArrival()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tr('Confirmer et rédiger la demande')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

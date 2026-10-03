import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Loader2, Plus, Store, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'

interface Application { status: 'pending' | 'approved' | 'rejected'; business_name: string; reject_reason: string | null }
interface Sale { id: string; product_label: string; customer: string | null; quantity: number; unit_cost_htg: number; unit_price_htg: number; sold_on: string }

const htg = (n: number) => `${Math.round(n).toLocaleString(LOCALE_TAG)} HTG`

function ApplyForm({ onDone }: { onDone: () => void }) {
  const [business, setBusiness] = useState('')
  const [activity, setActivity] = useState('')
  const [volume, setVolume] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    const { data, error } = await supabase.rpc('apply_reseller', { p_business_name: business, p_activity: activity, p_monthly_volume: Number(volume) || 0 })
    setBusy(false)
    const r = data as { success?: boolean; error?: string } | null
    if (error || !r?.success) { toast.error(r?.error ?? tr('Action impossible.')); return }
    toast.success(tr('Demande envoyée. Nous revenons vers vous rapidement.'))
    onDone()
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="space-y-1.5">
        <Label htmlFor="rs-business">{tr('Nom de votre activité')}</Label>
        <Input id="rs-business" value={business} onChange={(e) => setBusiness(e.target.value)} maxLength={120} className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rs-activity">{tr('Ce que vous revendez')}</Label>
        <Textarea id="rs-activity" value={activity} onChange={(e) => setActivity(e.target.value)} maxLength={500} rows={3} className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rs-volume">{tr('Achats prévus par mois (HTG)')}</Label>
        <Input id="rs-volume" value={volume} onChange={(e) => setVolume(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="rounded-xl" />
      </div>
      <Button onClick={() => void submit()} disabled={busy || business.trim().length < 2} className="h-11 w-full rounded-xl">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('Demander le statut revendeur')}
      </Button>
    </div>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [purchases, setPurchases] = useState<{ total: number; count: number }>({ total: 0, count: 0 })
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [customer, setCustomer] = useState('')
  const [qty, setQty] = useState('1')
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('reseller_sales').select('id, product_label, customer, quantity, unit_cost_htg, unit_price_htg, sold_on').order('sold_on', { ascending: false }).limit(100),
      supabase.from('product_orders').select('total_htg').eq('payment_status', 'paid').gte('created_at', since),
    ])
    setSales((s ?? []) as Sale[])
    const paid = (p ?? []) as Array<{ total_htg: number }>
    setPurchases({ total: paid.reduce((n, o) => n + Number(o.total_htg), 0), count: paid.length })
    setLoading(false)
  }, [user])

  useEffect(() => { void load() }, [load])

  const stats = useMemo(() => {
    const since = Date.now() - 30 * 86_400_000
    const recent = sales.filter((x) => new Date(x.sold_on).getTime() >= since)
    return {
      revenue: recent.reduce((n, x) => n + x.quantity * x.unit_price_htg, 0),
      margin: recent.reduce((n, x) => n + x.quantity * (x.unit_price_htg - x.unit_cost_htg), 0),
      count: recent.length,
    }
  }, [sales])

  async function add() {
    if (!user) return
    setBusy(true)
    const { error } = await supabase.from('reseller_sales').insert({
      user_id: user.id, product_label: label.trim(), customer: customer.trim() || null,
      quantity: Math.max(1, Math.floor(Number(qty) || 1)), unit_cost_htg: Number(cost) || 0, unit_price_htg: Number(price) || 0,
    })
    setBusy(false)
    if (error) { toast.error(tr('Action impossible.')); return }
    setLabel(''); setCustomer(''); setQty('1'); setCost(''); setPrice('')
    await load()
  }

  async function remove(id: string) {
    await supabase.from('reseller_sales').delete().eq('id', id)
    await load()
  }

  const marginPct = stats.revenue > 0 ? Math.round((stats.margin / stats.revenue) * 100) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          [tr('Achats chez KONVWA (30 j)'), htg(purchases.total), tr('{0} commande(s)', purchases.count)],
          [tr('Ventes enregistrées (30 j)'), htg(stats.revenue), tr('{0} vente(s)', stats.count)],
          [tr('Marge (30 j)'), htg(stats.margin), marginPct == null ? '—' : `${marginPct} %`],
        ].map(([k, v, hint], i) => (
          <div key={k} className={cn('rounded-2xl border border-gray-100 bg-white p-4 shadow-sm', i === 2 && 'col-span-2')}>
            <p className="text-xs font-medium text-muted-foreground">{k}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{v}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      <Link to="/products" className="flex items-center justify-between rounded-2xl bg-primary/5 px-5 py-4 text-sm font-bold text-primary">
        {tr('Voir le catalogue en gros (prix revendeur)')}<Store className="h-4 w-4" />
      </Link>

      <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold">{tr('Enregistrer une vente')}</p>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={tr('Produit vendu')} maxLength={160} className="rounded-xl" aria-label={tr('Produit vendu')} />
        <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder={tr('Client (optionnel)')} maxLength={120} className="rounded-xl" aria-label={tr('Client (optionnel)')} />
        <div className="grid grid-cols-3 gap-2">
          <Input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder={tr('Qté')} className="rounded-xl" aria-label={tr('Quantité')} />
          <Input value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={tr('Coût unitaire')} className="rounded-xl" aria-label={tr('Coût unitaire')} />
          <Input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={tr('Prix de vente')} className="rounded-xl" aria-label={tr('Prix de vente')} />
        </div>
        <Button onClick={() => void add()} disabled={busy || !label.trim() || !price} className="h-11 w-full gap-2 rounded-xl">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{tr('Ajouter')}
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <p className="border-b border-gray-100 px-5 py-3 text-sm font-bold">{tr('Mes ventes')}</p>
        {loading ? <div className="h-16 animate-pulse bg-muted/40" /> : sales.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">{tr('Aucune vente enregistrée.')}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sales.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{x.product_label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {x.quantity} × {Math.round(x.unit_price_htg).toLocaleString(LOCALE_TAG)} · {new Date(x.sold_on).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' })}{x.customer ? ` · ${x.customer}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={cn('font-semibold tabular-nums', x.unit_price_htg >= x.unit_cost_htg ? 'text-emerald-700' : 'text-destructive')}>
                    {htg(x.quantity * (x.unit_price_htg - x.unit_cost_htg))}
                  </span>
                  <button type="button" onClick={() => void remove(x.id)} aria-label={tr('Supprimer')} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function ResellerPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [app, setApp] = useState<Application | null | undefined>(undefined)

  const loadApp = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('reseller_applications').select('status, business_name, reject_reason').eq('user_id', user.id).maybeSingle()
    setApp((data as Application | null) ?? null)
  }, [user])

  useEffect(() => { void loadApp() }, [loadApp])

  return (
    <div className="min-h-full bg-[#F4F5F7] px-4 pb-10">
      <div className="flex items-center gap-2 pt-4 pb-3">
        <button onClick={() => navigate(-1)} aria-label={tr('Retour')} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"><ChevronLeft className="h-5 w-5" /></button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{tr('Espace revendeur')}</h1>
          <p className="text-xs text-muted-foreground">{tr('Prix revendeur, catalogue en gros et suivi de vos marges.')}</p>
        </div>
      </div>

      {profile?.is_reseller ? <Dashboard /> : app === undefined ? (
        <div className="h-32 animate-pulse rounded-2xl bg-white" />
      ) : app?.status === 'pending' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{tr('Votre demande pour « {0} » est en cours d\'examen.', app.business_name)}</div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white p-5 text-sm shadow-sm">
            <p className="font-bold">{tr('Devenez revendeur KONVWA')}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>{tr('Prix réduits sur les produits du catalogue')}</li>
              <li>{tr('Accès au catalogue en gros')}</li>
              <li>{tr('Tableau de vos ventes et de vos marges')}</li>
            </ul>
            {app?.status === 'rejected' && <p className="mt-3 text-destructive">{tr('Demande précédente refusée : {0}', app.reject_reason ?? '—')}</p>}
          </div>
          <ApplyForm onDone={() => void loadApp()} />
        </div>
      )}
    </div>
  )
}

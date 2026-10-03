import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Package, Truck, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useStepUp } from '@/lib/step-up'
import { needsShippingPayment, productOrderStage, productOrderStageLabel, productOrderStep } from '@/lib/product-order'
import { cn } from '@/lib/utils'
import { tr, trServer, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'

interface Item { id: string; product_name: string; product_price_htg: number; quantity: number; subtotal_htg: number }
interface Order {
  id: string; tracking_code: string | null; status: string; payment_status: string; total_htg: number; created_at: string
  received_at: string | null; shipping_amount_htg: number | null; shipping_paid_at: string | null; shipping_note: string | null
}

const STEPS = [
  () => tr('Achat payé'),
  () => tr('Colis arrivé'),
  () => tr('Expédition payée'),
  () => tr('Expédié'),
  () => tr('Livré'),
]

export function ProductOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { confirmPayment } = useStepUp()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

  const load = useCallback(async () => {
    if (!user || !id) return
    const [o, i, w] = await Promise.all([
      supabase.from('product_orders')
        .select('id, tracking_code, status, payment_status, total_htg, created_at, received_at, shipping_amount_htg, shipping_paid_at, shipping_note')
        .eq('id', id).eq('user_id', user.id).maybeSingle(),
      supabase.from('product_order_items').select('id, product_name, product_price_htg, quantity, subtotal_htg').eq('order_id', id),
      supabase.from('wallets').select('available_balance').eq('user_id', user.id).maybeSingle(),
    ])
    if (!o.data) { toast.error(tr('Commande introuvable')); navigate('/orders', { replace: true }); return }
    setOrder(o.data as Order)
    setItems((i.data ?? []) as Item[])
    setBalance(Number(w.data?.available_balance ?? 0))
    setLoading(false)
  }, [user, id, navigate])
  useEffect(() => { void load() }, [load])

  async function payShipping() {
    if (!order?.shipping_amount_htg) return
    setPaying(true)
    if (!(await confirmPayment(order.shipping_amount_htg))) { setPaying(false); return }
    const { data, error } = await supabase.rpc('pay_product_order_shipping', { p_order_id: order.id })
    setPaying(false)
    if (error || !data?.success) { toast.error(trServer(data?.error ?? error?.message ?? 'Erreur')); return }
    toast.success(tr('Expédition payée. Votre colis va partir vers Haïti.'))
    void load()
  }

  if (loading || !order) {
    return <div className="space-y-3 px-4 py-6"><Skeleton className="h-14 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
  }

  const stage = productOrderStage(order)
  const step = productOrderStep(stage)
  const due = needsShippingPayment(order)
  const short = order.shipping_amount_htg != null && balance < order.shipping_amount_htg

  return (
    <div className="min-h-full bg-[#F4F5F7] pb-10">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <button type="button" onClick={() => navigate('/orders')} aria-label={tr('Retour')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold">{tr('Commande catalogue')}</h1>
          <p className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <span className={cn('shrink-0 rounded-full border px-3 py-0.5 text-xs font-semibold',
          stage === 'arrived' ? 'border-amber-200 bg-amber-50 text-amber-700'
            : stage === 'cancelled' ? 'border-gray-200 bg-gray-100 text-gray-500'
            : stage === 'delivered' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-sky-200 bg-sky-50 text-sky-700')}>
          {productOrderStageLabel(stage)}
        </span>
      </div>

      <div className="space-y-3 px-4 pt-4">
        {/* Shipping to pay */}
        {due && order.shipping_amount_htg != null && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100"><Truck className="h-4 w-4 text-amber-700" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-900">{tr('Votre colis est arrivé à l\'entrepôt')}</p>
                <p className="mt-0.5 text-sm text-amber-800">{tr('Payez l\'expédition pour qu\'il parte vers Haïti.')}</p>
                {order.shipping_note && <p className="mt-1 text-xs text-amber-800">{order.shipping_note}</p>}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-900">{tr('Frais d\'expédition')}</span>
              <span className="text-xl font-black text-amber-900">{order.shipping_amount_htg.toLocaleString(LOCALE_TAG)} HTG</span>
            </div>
            {short ? (
              <Link to="/wallet" className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white">
                <Wallet className="h-4 w-4" aria-hidden="true" />{tr('Recharger mon portefeuille')}
              </Link>
            ) : (
              <button type="button" onClick={() => void payShipping()} disabled={paying} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-60">
                {paying && <Loader2 className="h-4 w-4 animate-spin" />}
                {tr('Payer l\'expédition')}
              </button>
            )}
            <p className="mt-2 text-center text-[11px] text-amber-800">{tr('Solde disponible : {0} HTG', balance.toLocaleString(LOCALE_TAG))}</p>
          </div>
        )}

        {/* Tracker */}
        {stage !== 'cancelled' && stage !== 'pending' && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <ol className="space-y-0">
              {STEPS.map((label, i) => {
                const done = i <= step
                return (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={cn('flex h-7 w-7 items-center justify-center rounded-full border-2', done ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-gray-300')}>
                        {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </span>
                      {i < STEPS.length - 1 && <span className={cn('h-6 w-0.5', i < step ? 'bg-primary' : 'bg-gray-200')} />}
                    </div>
                    <div className="pb-4">
                      <p className={cn('text-sm font-semibold', done ? 'text-foreground' : 'text-muted-foreground')}>{label()}</p>
                      {i === 1 && order.received_at && <p className="text-xs text-muted-foreground">{new Date(order.received_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {/* Items */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3"><p className="flex items-center gap-2 text-sm font-bold"><Package className="h-4 w-4 text-primary" aria-hidden="true" />{tr('Produits achetés')}</p></div>
          <ul className="divide-y divide-gray-100">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{it.product_name}</p>
                  <p className="text-xs text-muted-foreground">{it.quantity} × {it.product_price_htg.toLocaleString(LOCALE_TAG)} HTG</p>
                </div>
                <p className="shrink-0 text-sm font-bold">{it.subtotal_htg.toLocaleString(LOCALE_TAG)} HTG</p>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5 border-t border-gray-100 px-4 py-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{tr('Achat des produits')}</span><span className="font-semibold">{order.total_htg.toLocaleString(LOCALE_TAG)} HTG</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tr('Expédition')}</span>
              <span className="font-semibold">
                {order.shipping_amount_htg == null ? tr('À payer à l\'arrivée du colis')
                  : order.shipping_amount_htg === 0 ? tr('Offerte')
                  : `${order.shipping_amount_htg.toLocaleString(LOCALE_TAG)} HTG${order.shipping_paid_at ? ` · ${tr('payée')}` : ''}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

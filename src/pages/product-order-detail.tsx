import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Package, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { needsShippingPayment, productOrderStage, productOrderStageLabel, productOrderStep } from '@/lib/product-order'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'

interface Item { id: string; product_name: string; product_price_htg: number; quantity: number; subtotal_htg: number }
interface Order {
  id: string; status: string; payment_status: string; total_htg: number; created_at: string
  received_at: string | null; shipping_request_id: string | null
  shipping_request: { status: string; quoted_amount_htg: number | null; paid_amount_htg: number | null; payment_due_at: string | null } | null
}

const STEPS = [
  () => tr('Achat payé'),
  () => tr('Colis arrivé'),
  () => tr('Devis d\'expédition'),
  () => tr('Expédition payée'),
  () => tr('Livré'),
]

export function ProductOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user || !id) return
    const [o, i] = await Promise.all([
      supabase.from('product_orders')
        .select('id, status, payment_status, total_htg, created_at, received_at, shipping_request_id, shipping_request:product_requests(status, quoted_amount_htg, paid_amount_htg, payment_due_at)')
        .eq('id', id).eq('user_id', user.id).maybeSingle(),
      supabase.from('product_order_items').select('id, product_name, product_price_htg, quantity, subtotal_htg').eq('order_id', id),
    ])
    if (!o.data) { toast.error(tr('Commande introuvable')); navigate('/orders', { replace: true }); return }
    setOrder(o.data as unknown as Order)
    setItems((i.data ?? []) as Item[])
    setLoading(false)
  }, [user, id, navigate])
  useEffect(() => { void load() }, [load])

  if (loading || !order) {
    return <div className="space-y-3 px-4 py-6"><Skeleton className="h-14 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
  }

  const stage = productOrderStage(order)
  const step = productOrderStep(stage)
  const due = needsShippingPayment(order)
  const reqId = order.shipping_request_id
  const quoted = order.shipping_request?.quoted_amount_htg ?? null

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
          stage === 'quote_ready' ? 'border-amber-200 bg-amber-50 text-amber-700'
            : stage === 'cancelled' ? 'border-gray-200 bg-gray-100 text-gray-500'
            : stage === 'delivered' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-sky-200 bg-sky-50 text-sky-700')}>
          {productOrderStageLabel(stage)}
        </span>
      </div>

      <div className="space-y-3 px-4 pt-4">
        {/* Shipping: same flow as any shipping request */}
        {reqId && stage === 'awaiting_quote' && (
          <Link to={`/shipments/${reqId}`} className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100"><Truck className="h-4 w-4 text-sky-700" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-sky-900">{tr('Votre colis est arrivé à l\'entrepôt')}</p>
              <p className="mt-0.5 text-sm text-sky-800">{tr('Nous mesurons le colis et préparons votre devis d\'expédition. Vous serez prévenu pour le payer.')}</p>
            </div>
          </Link>
        )}
        {reqId && due && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100"><Truck className="h-4 w-4 text-amber-700" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-900">{tr('Votre devis d\'expédition est prêt')}</p>
                <p className="mt-0.5 text-sm text-amber-800">{tr('Payez l\'expédition pour que votre colis parte vers Haïti.')}</p>
                {order.shipping_request?.payment_due_at && (
                  <p className="mt-1 text-xs text-amber-800">{tr('À régler avant le {0}', new Date(order.shipping_request.payment_due_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
                )}
              </div>
            </div>
            {quoted != null && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-900">{tr('Frais d\'expédition')}</span>
                <span className="text-xl font-black text-amber-900">{quoted.toLocaleString(LOCALE_TAG)} HTG</span>
              </div>
            )}
            <Link to={`/shipments/${reqId}`} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white">
              {tr('Voir le devis et payer')}
            </Link>
          </div>
        )}
        {reqId && !due && stage !== 'awaiting_quote' && stage !== 'cancelled' && stage !== 'pending' && stage !== 'purchasing' && (
          <Link to={`/shipments/${reqId}`} className="block rounded-2xl border border-gray-100 bg-white p-4 text-sm font-semibold text-primary shadow-sm">
            {tr('Suivre l\'expédition')}
          </Link>
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
                {quoted != null ? `${quoted.toLocaleString(LOCALE_TAG)} HTG` : tr('Devis envoyé à l\'arrivée du colis')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

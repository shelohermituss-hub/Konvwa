import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Package, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { isCancelledOrder, needsShippingPayment, productOrderLabel, trackingStatusOf } from '@/lib/product-order'
import { TimelineStep } from '@/components/shared/timeline-step'
import { ShippingMethodPicker } from '@/components/shared/shipping-method-picker'
import { cn } from '@/lib/utils'
import { tr, LOCALE_TAG } from '@/lib/i18n'
import type { OrderStatus } from '@/types'

interface Item { id: string; product_name: string; product_price_htg: number; quantity: number; subtotal_htg: number }
interface Order {
  id: string; tracking_code: string; status: string; payment_status: string; tracking_status: string | null
  total_htg: number; created_at: string; shipping_paid_at: string | null; shipping_amount_htg: number | null; shipping_prepaid?: boolean
  chosen_shipping_rate: { name: string } | null
}

export function ProductOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user || !id) return
    const [o, i, w] = await Promise.all([
      supabase.from('product_orders')
        .select('id, tracking_code, status, payment_status, tracking_status, total_htg, created_at, shipping_paid_at, shipping_amount_htg, shipping_prepaid, chosen_shipping_rate:shipping_rates(name)')
        .eq('id', id).eq('user_id', user.id).maybeSingle(),
      supabase.from('product_order_items').select('id, product_name, product_price_htg, quantity, subtotal_htg').eq('order_id', id),
      supabase.from('wallets').select('available_balance').eq('user_id', user.id).maybeSingle(),
    ])
    if (!o.data) { toast.error(tr('Commande introuvable')); navigate('/orders', { replace: true }); return }
    setOrder(o.data as unknown as Order)
    setItems((i.data ?? []) as Item[])
    setBalance(w.data?.available_balance ?? null)
    setLoading(false)
  }, [user, id, navigate])
  useEffect(() => { void load() }, [load])

  if (loading || !order) {
    return <div className="space-y-3 px-4 py-6"><Skeleton className="h-14 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
  }

  const cancelled = isCancelledOrder(order)
  const due = needsShippingPayment(order)
  const delivered = order.tracking_status === 'delivered'
  const shippingPaid = order.shipping_amount_htg

  return (
    <div className="min-h-full bg-[#F4F5F7] pb-10">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <button type="button" onClick={() => navigate('/orders')} aria-label={tr('Retour')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold">{tr('Commande catalogue')}</h1>
          <p className="font-mono text-xs text-muted-foreground">#{order.tracking_code}</p>
        </div>
        <span className={cn('shrink-0 rounded-full border px-3 py-0.5 text-xs font-semibold',
          due ? 'border-amber-200 bg-amber-50 text-amber-700'
            : cancelled ? 'border-gray-200 bg-gray-100 text-gray-500'
            : delivered ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-sky-200 bg-sky-50 text-sky-700')}>
          {productOrderLabel(order)}
        </span>
      </div>

      <div className="space-y-3 px-4 pt-4">
        {/* The parcel is at the warehouse: choose the shipping method (fees computed by the database) and pay */}
        {due && <ShippingMethodPicker kind="product_order" orderId={order.id} balance={balance} onPaid={() => void load()} />}

        {order.tracking_status === 'shipping_paid' && (
          <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100"><Truck className="h-4 w-4 text-sky-700" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-sky-900">{tr('Expédition payée')}</p>
              <p className="mt-0.5 text-sm text-sky-800">{tr('Votre colis est prêt à partir : il sera mis dans la prochaine cargaison.')}</p>
            </div>
          </div>
        )}

        {/* Tracking: the normal order tracking, starting at "Payé" */}
        {!cancelled && order.payment_status === 'paid' && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <TimelineStep currentStatus={trackingStatusOf(order) as OrderStatus} startAt="paid" withShippingPaid />
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
            <div className="flex justify-between"><span className="text-muted-foreground">{tr('Achat des produits')}</span><span className="font-semibold">{(order.shipping_prepaid ? order.total_htg - (shippingPaid ?? 0) : order.total_htg).toLocaleString(LOCALE_TAG)} HTG</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tr('Expédition')}</span>
              <span className="font-semibold">
                {shippingPaid != null
                  ? `${shippingPaid.toLocaleString(LOCALE_TAG)} HTG${order.chosen_shipping_rate ? ` · ${order.chosen_shipping_rate.name}` : ''}`
                  : tr('Calculée à l\'arrivée du colis, selon le mode choisi')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

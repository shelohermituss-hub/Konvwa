import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { CreditCard, Package } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface PaidOrder {
  id: string
  tracking_code: string
  status: string
  total_paid: number
  created_at: string
  quotes: {
    total: number
    product_requests: { product_name: string } | null
  } | null
}

const PAID_STATUSES = ['processing', 'in_transit', 'arrived_haiti', 'delivered']

export function BillingPage() {
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const [orders, setOrders] = useState<PaidOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('orders')
      .select('id, tracking_code, status, total_paid, created_at, quotes(total, product_requests(product_name))')
      .eq('user_id', user.id)
      .in('status', PAID_STATUSES)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setOrders(data as unknown as PaidOrder[])
        setLoading(false)
      })
  }, [user])

  const dateLocale = lang === 'fr' ? fr : undefined

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('billing.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('billing.subtitle')}</p>
      </div>

      <div className="px-4 pb-6">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-3 items-center px-4 py-3 border-b border-border/50 bg-muted/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{t('billing.reference')}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{t('billing.product')}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{t('billing.date')}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 text-right">{t('billing.amount')}</span>
          </div>

          {loading ? (
            <div className="p-5 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/25 mb-3" />
              <p className="font-semibold text-sm text-muted-foreground">{t('billing.empty')}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{t('billing.empty_sub')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {orders.map((order) => {
                const productName = order.quotes?.product_requests?.product_name
                const amount = order.quotes?.total ?? order.total_paid
                const date = new Date(order.created_at)

                return (
                  <div
                    key={order.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-3 items-center px-4 py-3.5 hover:bg-muted/20 transition-colors"
                  >
                    {/* Reference */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8 shrink-0">
                        <Package className="h-3.5 w-3.5 text-primary" strokeWidth={1.6} />
                      </div>
                      <span className="text-xs font-mono font-semibold text-foreground truncate">
                        {order.tracking_code}
                      </span>
                    </div>

                    {/* Product */}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {productName || '—'}
                      </p>
                      <div className="mt-0.5">
                        <StatusBadge status={order.status} />
                      </div>
                    </div>

                    {/* Date */}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(date, 'dd MMM yy', { locale: dateLocale })}
                    </span>

                    {/* Amount */}
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">
                        {amount.toLocaleString('fr-HT')}
                      </p>
                      <p className="text-[9px] font-semibold text-muted-foreground">HTG</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

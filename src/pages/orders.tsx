import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { Package, Search, Plus, ChevronRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface OrderRow {
  id: string
  tracking_code: string
  status: string
  total_paid: number
  created_at: string
  quotes: {
    total: number
    estimated_delivery_days: number | null
    product_requests: { product_name: string } | null
  } | null
}

const STATUS_FILTERS = [
  { value: 'all', label: 'Tout' },
  { value: 'awaiting_payment', label: 'Paiement' },
  { value: 'paid', label: 'Payé' },
  { value: 'in_transit', label: 'Transit' },
  { value: 'arrived_haiti', label: 'Arrivé' },
  { value: 'delivered', label: 'Livré' },
  { value: 'cancelled', label: 'Annulé' },
]

export function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    if (!user) return
    supabase
      .from('orders')
      .select('id, tracking_code, status, total_paid, created_at, quotes(total, estimated_delivery_days, product_requests(product_name))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setOrders(data as unknown as OrderRow[])
        setLoading(false)
      })
  }, [user])

  const filtered = orders.filter((o) => {
    const name = o.quotes?.product_requests?.product_name ?? ''
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || o.tracking_code.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  function deliveryDate(o: OrderRow) {
    if (!o.quotes?.estimated_delivery_days) return null
    const d = new Date(o.created_at)
    d.setDate(d.getDate() + o.quotes.estimated_delivery_days)
    return d
  }

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Commandes</h1>
          <p className="text-sm text-muted-foreground">{orders.length} commande{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild size="sm" className="rounded-full gap-1.5">
          <Link to="/submit">
            <Plus className="h-4 w-4" />
            Nouveau
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl border-border bg-muted/30"
          />
        </div>
      </div>

      {/* Status filters */}
      <div className="px-4 pb-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors border',
              statusFilter === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="px-4 pb-6 space-y-3">
        {loading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[88px] rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-muted-foreground">
              {search || statusFilter !== 'all' ? 'Aucun résultat' : 'Aucune commande'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
              {search || statusFilter !== 'all' ? "Essayez d'autres filtres" : 'Soumettez votre premier produit'}
            </p>
            {!search && statusFilter === 'all' && (
              <Button asChild size="sm" className="rounded-full">
                <Link to="/submit"><Plus className="mr-1.5 h-3.5 w-3.5" />Soumettre</Link>
              </Button>
            )}
          </div>
        ) : (
          filtered.map((order) => {
            const delivery = deliveryDate(order)
            return (
              <Link key={order.id} to={`/orders/${order.id}`}>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/20 transition-colors">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {order.quotes?.product_requests?.product_name || 'Produit'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{order.tracking_code}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <StatusBadge status={order.status} />
                      {delivery && (
                        <span className="text-[10px] text-muted-foreground">
                          Livr. {delivery.toLocaleDateString('fr-HT', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="font-bold text-sm">{(order.quotes?.total ?? order.total_paid).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">HTG</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

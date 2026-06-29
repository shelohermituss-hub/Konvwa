import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Plus, ChevronRight, Clock } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import IconBoite from 'flat-color-icons/svg/package.svg'

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

interface DraftRow {
  id: string
  product_name: string
  category: string | null
  status: string
  created_at: string
  urgency: string
  product_url: string | null
  notes: string | null
  quantity: number
  budget_estimate: number | null
}

const STATUS_FILTER_KEYS = [
  { value: 'all',              key: 'orders.f.all' },
  { value: 'drafts',           key: 'orders.f.drafts' },
  { value: 'awaiting_payment', key: 'orders.f.awaiting_payment' },
  { value: 'processing',       key: 'orders.f.processing' },
  { value: 'in_transit',       key: 'orders.f.in_transit' },
  { value: 'arrived_haiti',    key: 'orders.f.arrived_haiti' },
  { value: 'delivered',        key: 'orders.f.delivered' },
  { value: 'cancelled',        key: 'orders.f.cancelled' },
]

export function OrdersPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedDraft, setSelectedDraft] = useState<DraftRow | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase
        .from('orders')
        .select('id, tracking_code, status, total_paid, created_at, quotes(total, estimated_delivery_days, product_requests(product_name))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('product_requests')
        .select('id, product_name, category, status, created_at, urgency, product_url, notes, quantity, budget_estimate')
        .eq('user_id', user.id)
        .in('status', ['submitted', 'reviewing'])
        .order('created_at', { ascending: false }),
    ]).then(([ordersRes, draftsRes]) => {
      if (ordersRes.data) setOrders(ordersRes.data as unknown as OrderRow[])
      if (draftsRes.data) setDrafts(draftsRes.data as DraftRow[])
      setLoading(false)
    })
  }, [user])

  const showDrafts = statusFilter === 'all' || statusFilter === 'drafts'
  const showOrders = statusFilter !== 'drafts'

  const filteredOrders = showOrders ? orders.filter((o) => {
    const name = o.quotes?.product_requests?.product_name ?? ''
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || o.tracking_code.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  }) : []

  const filteredDrafts = showDrafts ? drafts.filter((d) =>
    d.product_name.toLowerCase().includes(search.toLowerCase())
  ) : []

  function deliveryDate(o: OrderRow) {
    if (!o.quotes?.estimated_delivery_days) return null
    const d = new Date(o.created_at)
    d.setDate(d.getDate() + o.quotes.estimated_delivery_days)
    return d
  }

  const isEmpty = filteredOrders.length === 0 && filteredDrafts.length === 0
  const totalCount = orders.length + drafts.length

  return (
    <div className="min-h-full bg-[#F4F5F7] w-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('orders.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} {t('orders.title').toLowerCase().replace(/s$/, '')}{totalCount !== 1 ? 's' : ''}
            {drafts.length > 0 && ` · ${drafts.length} brouillon${drafts.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          to="/submit"
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
        >
          <Plus className="h-4 w-4" />
          {t('common.new')}
        </Link>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl bg-[#F0F1F5] border-0 h-11 font-medium focus-visible:ring-1 focus-visible:ring-primary/40"
          />
        </div>
      </div>

      {/* Status filters */}
      <div className="px-4 pb-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {STATUS_FILTER_KEYS.map((f) => (
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
            {t(f.key)}
            {f.value === 'drafts' && drafts.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-warning/20 text-warning text-[9px] font-bold">
                {drafts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="px-4 pb-6 space-y-3">
        {loading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[88px] rounded-2xl" />)
        ) : isEmpty ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
            <img src={IconBoite} alt="" className="h-12 w-12 mx-auto opacity-30 mb-3" />
            <p className="font-semibold text-muted-foreground">
              {search || (statusFilter !== 'all' && statusFilter !== 'drafts') ? t('common.no_result') : t('orders.no_orders')}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
              {search ? t('orders.try_other') : t('orders.submit_first')}
            </p>
            {!search && (
              <Link
                to="/submit"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />{t('common.submit')}
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* ── Brouillons (product_requests en attente de traitement admin) ── */}
            {filteredDrafts.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 px-1">
                  {t('orders.pending_section')}
                </p>
                {filteredDrafts.map((draft) => (
                  <button
                    key={draft.id}
                    onClick={() => setSelectedDraft(draft)}
                    className="w-full flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning/4 p-4 shadow-sm hover:border-warning/50 hover:bg-warning/8 transition-colors text-left"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/12 shrink-0">
                      <Clock className="h-5 w-5 text-warning" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate text-foreground">
                        {draft.product_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {draft.category || 'Autre'} · {draft.urgency === 'express' ? 'Express' : draft.urgency === 'urgent' ? 'Urgent' : 'Normal'}
                      </p>
                      <div className="mt-1.5">
                        <span className="inline-flex items-center rounded-full bg-warning/15 text-warning text-[10px] font-bold px-2 py-0.5">
                          {t('orders.draft_label')}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(draft.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── Commandes confirmées ── */}
            {filteredOrders.length > 0 && (
              <div className="space-y-2.5">
                {filteredDrafts.length > 0 && (
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 px-1 pt-1">
                    Commandes
                  </p>
                )}
                {filteredOrders.map((order) => {
                  const delivery = deliveryDate(order)
                  return (
                    <Link key={order.id} to={`/orders/${order.id}`}>
                      <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:border-primary/20 transition-colors">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 shrink-0">
                          <img src={IconBoite} alt="" className="h-8 w-8 object-contain" />
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
                                {t('common.delivery')} {delivery.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
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
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Draft detail dialog */}
      <Dialog open={!!selectedDraft} onOpenChange={(o) => { if (!o) setSelectedDraft(null) }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-warning shrink-0" />
              Demande en cours d'examen
            </DialogTitle>
          </DialogHeader>
          {selectedDraft && (
            <div className="space-y-3 pb-2">
              <div className="rounded-xl bg-warning/8 border border-warning/20 p-3">
                <p className="text-xs text-warning font-semibold">
                  Votre demande a bien été reçue. Notre équipe l'examine et vous enverra un devis sous peu.
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Produit</span>
                  <span className="font-semibold text-right max-w-[55%] text-xs">{selectedDraft.product_name}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Catégorie</span>
                  <span className="font-semibold capitalize">{selectedDraft.category || 'Autre'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Quantité</span>
                  <span className="font-semibold">{selectedDraft.quantity}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Urgence</span>
                  <span className="font-semibold">
                    {selectedDraft.urgency === 'express' ? 'Express (1-2 sem.)' : selectedDraft.urgency === 'urgent' ? 'Urgent (2-3 sem.)' : 'Normal (4-6 sem.)'}
                  </span>
                </div>
                {selectedDraft.budget_estimate && (
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">Budget estimé</span>
                    <span className="font-semibold">{selectedDraft.budget_estimate.toLocaleString()} HTG</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Soumis le</span>
                  <span className="font-semibold">{new Date(selectedDraft.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
              {selectedDraft.notes && (
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Notes</p>
                  <p className="text-xs">{selectedDraft.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

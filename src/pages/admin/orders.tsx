import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { Search, Filter, MoreHorizontal, Eye, Edit, MessageSquare, Ban, Package, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AdminOrder {
  id: string
  tracking_code: string
  status: string
  total_paid: number
  created_at: string
  user_id: string
  customer_name?: string
  quotes: {
    total: number
    product_requests: { product_name: string } | null
  } | null
}

const ORDER_STATUSES = [
  { value: 'draft',              label: 'Brouillon' },
  { value: 'quote_sent',        label: 'Devis envoyé' },
  { value: 'quote_accepted',    label: 'Devis accepté' },
  { value: 'awaiting_payment',  label: 'En attente de paiement' },
  { value: 'paid',              label: 'Payé' },
  { value: 'purchasing',        label: 'En achat' },
  { value: 'in_china_warehouse',label: 'Entrepôt Chine' },
  { value: 'shipped',           label: 'Expédié' },
  { value: 'in_transit',        label: 'En transit' },
  { value: 'arrived_haiti',     label: 'Arrivé en Haïti' },
  { value: 'customs_processing',label: 'Dédouanement' },
  { value: 'out_for_delivery',  label: 'En livraison' },
  { value: 'delivered',         label: 'Livré' },
  { value: 'closed',            label: 'Clôturé' },
  { value: 'cancelled',         label: 'Annulé' },
]

const STATUS_FILTERS = [
  { value: 'all',               label: 'Tous les statuts' },
  { value: 'awaiting_payment',  label: 'En attente de paiement' },
  { value: 'paid',              label: 'Payé' },
  { value: 'purchasing',        label: 'En achat' },
  { value: 'in_transit',        label: 'En transit' },
  { value: 'arrived_haiti',     label: 'Arrivé' },
  { value: 'delivered',         label: 'Livrées' },
  { value: 'cancelled',         label: 'Annulées' },
]

const PAGE_SIZE = 15

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editOrder, setEditOrder] = useState<AdminOrder | null>(null)
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)

  async function loadOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, tracking_code, status, total_paid, created_at, user_id, quotes(total, product_requests(product_name))')
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    const userIds = [...new Set(data.map(o => o.user_id))]
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds)

    const profileMap = Object.fromEntries((profilesData || []).map(p => [p.user_id, p.full_name]))

    setOrders(data.map(o => ({
      ...(o as unknown as AdminOrder),
      customer_name: profileMap[o.user_id] || '—',
    })))
    setLoading(false)
  }

  useEffect(() => { loadOrders() }, [])

  const filteredOrders = orders.filter((order) => {
    const productName = order.quotes?.product_requests?.product_name ?? ''
    const customerName = order.customer_name ?? ''
    const matchesSearch =
      customerName.toLowerCase().includes(search.toLowerCase()) ||
      order.tracking_code.toLowerCase().includes(search.toLowerCase()) ||
      productName.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE)
  const pageOrders = filteredOrders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  async function handleStatusUpdate() {
    if (!editOrder || !newStatus) return
    setSaving(true)
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', editOrder.id)
    if (error) {
      toast.error('Erreur lors de la mise à jour du statut.')
    } else {
      toast.success('Statut mis à jour.')
      setOrders(prev => prev.map(o => o.id === editOrder.id ? { ...o, status: newStatus } : o))
      setEditOrder(null)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des commandes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : `${filteredOrders.length} commande${filteredOrders.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par client, code ou produit..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              className="pl-9 rounded-xl"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
            <SelectTrigger className="w-full sm:w-52 rounded-xl">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status filter pills */}
        <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-border/40">
          {STATUS_FILTERS.slice(1).map((f) => {
            const count = orders.filter(o => o.status === f.value).length
            if (count === 0) return null
            return (
              <button
                key={f.value}
                onClick={() => { setStatusFilter(statusFilter === f.value ? 'all' : f.value); setPage(0) }}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  statusFilter === f.value
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                )}
              >
                {f.label}
                <span className={cn(
                  'flex h-4 min-w-4 items-center justify-center rounded-full text-[10px] font-bold px-0.5',
                  statusFilter === f.value ? 'bg-white/20 text-white' : 'bg-background text-foreground'
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-muted-foreground">Aucune commande trouvée</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Modifiez vos filtres de recherche</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground w-36">Code</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Client</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Produit</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Statut</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Montant</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Date</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <span className="font-mono text-xs font-medium text-foreground">{order.tracking_code}</span>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{order.customer_name || '—'}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-sm text-muted-foreground truncate max-w-[180px]">
                        {order.quotes?.product_requests?.product_name || '—'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-semibold text-sm">{(order.quotes?.total ?? order.total_paid).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">HTG</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-48">
                          <DropdownMenuItem className="rounded-lg cursor-pointer">
                            <Eye className="mr-2 h-4 w-4" />Voir les détails
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="rounded-lg cursor-pointer"
                            onClick={() => { setEditOrder(order); setNewStatus(order.status) }}
                          >
                            <Edit className="mr-2 h-4 w-4" />Modifier le statut
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-lg cursor-pointer">
                            <MessageSquare className="mr-2 h-4 w-4" />Envoyer un message
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="rounded-lg cursor-pointer text-destructive focus:text-destructive"
                            onClick={async () => {
                              await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
                              setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o))
                              toast.success('Commande annulée.')
                            }}
                          >
                            <Ban className="mr-2 h-4 w-4" />Annuler
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <p className="text-xs text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredOrders.length)} sur {filteredOrders.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Button
                      key={i}
                      variant={i === page ? 'default' : 'ghost'}
                      size="icon"
                      className="h-8 w-8 rounded-lg text-xs"
                      onClick={() => setPage(i)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit status dialog */}
      <Dialog open={!!editOrder} onOpenChange={(open) => { if (!open) setEditOrder(null) }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Modifier le statut</DialogTitle>
            <DialogDescription>
              Commande <span className="font-mono font-semibold">{editOrder?.tracking_code}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div>
              <Label className="text-sm font-semibold">Statut actuel</Label>
              <div className="mt-2">
                {editOrder && <StatusBadge status={editOrder.status} />}
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">Nouveau statut</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="mt-2 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrder(null)} className="rounded-xl">Annuler</Button>
            <Button onClick={handleStatusUpdate} disabled={saving || newStatus === editOrder?.status} className="rounded-xl">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

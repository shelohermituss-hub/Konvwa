import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Search, Filter, MoreHorizontal, Eye, Edit, MessageSquare, Ban, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

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
  'draft', 'quote_sent', 'quote_accepted', 'awaiting_payment',
  'paid', 'purchasing', 'in_china_warehouse', 'shipped',
  'in_transit', 'arrived_haiti', 'customs_processing',
  'out_for_delivery', 'delivered', 'closed', 'cancelled',
]

const statusFilters = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'awaiting_payment', label: 'En attente de paiement' },
  { value: 'paid', label: 'Payé' },
  { value: 'purchasing', label: 'En achat' },
  { value: 'in_transit', label: 'En transit' },
  { value: 'delivered', label: 'Livrées' },
  { value: 'cancelled', label: 'Annulées' },
]

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editOrder, setEditOrder] = useState<AdminOrder | null>(null)
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadOrders() {
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

  useEffect(() => {
    loadOrders()
  }, [])

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
    <div className="space-y-6">
      <PageHeader
        title="Gestion des commandes"
        description="Affichez et gérez toutes les commandes"
      />

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par client, code ou produit..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusFilters.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <EmptyState icon={Package} title="Aucune commande trouvée" description="Il n'y a aucune commande correspondant à votre recherche." />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">{order.tracking_code}</TableCell>
                      <TableCell>
                        <p className="font-medium">{order.customer_name || '—'}</p>
                      </TableCell>
                      <TableCell>{order.quotes?.product_requests?.product_name || '—'}</TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {(order.quotes?.total ?? order.total_paid).toLocaleString()} HTG
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('fr-HT')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              Voir détails
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditOrder(order); setNewStatus(order.status) }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Modifier statut
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Envoyer message
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={async () => {
                                await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
                                setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o))
                                toast.success('Commande annulée.')
                              }}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Annuler commande
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editOrder} onOpenChange={(open) => { if (!open) setEditOrder(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le statut</DialogTitle>
            <DialogDescription>
              Commande {editOrder?.tracking_code}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>Nouveau statut</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrder(null)}>Annuler</Button>
            <Button onClick={handleStatusUpdate} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

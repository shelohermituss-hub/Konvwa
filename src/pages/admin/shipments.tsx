import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Ship, Plus, MoreHorizontal, Package, Search, Edit, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ShipmentStatus } from '@/types'

interface Shipment {
  id: string
  batch_code: string
  status: ShipmentStatus
  vessel_info: string | null
  departure_date: string | null
  estimated_arrival: string | null
  actual_arrival: string | null
  container_number: string | null
  weight_kg: number | null
  volume_m3: number | null
  notes: string | null
  created_at: string
  order_count?: number
}

const SHIPMENT_STATUSES: { value: ShipmentStatus; label: string }[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'consolidating', label: 'Consolidation' },
  { value: 'packed', label: 'Emballé' },
  { value: 'loaded', label: 'Chargé' },
  { value: 'sailing', label: 'En mer' },
  { value: 'arrived', label: 'Arrivé' },
  { value: 'cleared', label: 'Dédouané' },
  { value: 'distributing', label: 'Distribution' },
  { value: 'completed', label: 'Terminé' },
]

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  consolidating: 'bg-warning/15 text-warning',
  packed: 'bg-warning/15 text-warning',
  loaded: 'bg-accent/15 text-accent',
  sailing: 'bg-primary/15 text-primary',
  arrived: 'bg-success/15 text-success',
  cleared: 'bg-success/15 text-success',
  distributing: 'bg-success/15 text-success',
  completed: 'bg-muted text-muted-foreground',
}

const emptyForm = {
  vessel_info: '',
  container_number: '',
  departure_date: '',
  estimated_arrival: '',
  weight_kg: '',
  volume_m3: '',
  notes: '',
}

export function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editShipment, setEditShipment] = useState<Shipment | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editStatus, setEditStatus] = useState<ShipmentStatus>('pending')
  const [saving, setSaving] = useState(false)
  const [assignOpen, setAssignOpen] = useState<Shipment | null>(null)
  const [pendingOrders, setPendingOrders] = useState<{ id: string; tracking_code: string; product_name: string }[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])

  async function loadShipments() {
    const { data: shipmentsData } = await supabase
      .from('shipments')
      .select('*')
      .order('created_at', { ascending: false })

    if (!shipmentsData) { setLoading(false); return }

    const ids = shipmentsData.map(s => s.id)
    const { data: junctions } = await supabase
      .from('order_shipments')
      .select('shipment_id')
      .in('shipment_id', ids)

    const countMap: Record<string, number> = {}
    ;(junctions || []).forEach(j => { countMap[j.shipment_id] = (countMap[j.shipment_id] || 0) + 1 })

    setShipments(shipmentsData.map(s => ({ ...(s as unknown as Shipment), order_count: countMap[s.id] || 0 })))
    setLoading(false)
  }

  async function loadPendingOrders() {
    const { data } = await supabase
      .from('orders')
      .select('id, tracking_code, quotes(product_requests(product_name))')
      .eq('status', 'paid')
    if (data) {
      setPendingOrders(data.map((o: any) => ({
        id: o.id,
        tracking_code: o.tracking_code,
        product_name: o.quotes?.product_requests?.product_name || 'Produit',
      })))
    }
  }

  useEffect(() => { loadShipments() }, [])

  async function handleCreate() {
    setSaving(true)
    const { error } = await supabase.from('shipments').insert({
      status: 'pending',
      vessel_info: form.vessel_info || null,
      container_number: form.container_number || null,
      departure_date: form.departure_date || null,
      estimated_arrival: form.estimated_arrival || null,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      volume_m3: form.volume_m3 ? parseFloat(form.volume_m3) : null,
      notes: form.notes || null,
    })
    if (error) toast.error('Erreur lors de la création.')
    else { toast.success('Expédition créée.'); setCreateOpen(false); setForm(emptyForm); await loadShipments() }
    setSaving(false)
  }

  async function handleStatusUpdate() {
    if (!editShipment) return
    setSaving(true)
    const { error } = await supabase.from('shipments').update({ status: editStatus, updated_at: new Date().toISOString() }).eq('id', editShipment.id)
    if (error) toast.error('Erreur.')
    else {
      toast.success('Statut mis à jour.')
      setShipments(prev => prev.map(s => s.id === editShipment.id ? { ...s, status: editStatus } : s))
      setEditShipment(null)
    }
    setSaving(false)
  }

  async function handleAssignOrders() {
    if (!assignOpen || selectedOrders.length === 0) return
    setSaving(true)
    const rows = selectedOrders.map(orderId => ({ order_id: orderId, shipment_id: assignOpen.id }))
    const { error } = await supabase.from('order_shipments').upsert(rows, { onConflict: 'order_id,shipment_id' })
    if (error) toast.error('Erreur lors de l\'assignation.')
    else {
      // Update order status to shipped
      await supabase.from('orders').update({ status: 'shipped' }).in('id', selectedOrders)
      toast.success(`${selectedOrders.length} commande(s) assignée(s).`)
      setAssignOpen(null)
      setSelectedOrders([])
      await loadShipments()
    }
    setSaving(false)
  }

  const filtered = shipments.filter(s =>
    s.batch_code.toLowerCase().includes(search.toLowerCase()) ||
    (s.vessel_info || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des expéditions"
        description="Créez et gérez les lots d'expédition maritime"
        action={
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle expédition
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par code ou bateau..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Ship} title="Aucune expédition" description="Créez votre première expédition maritime." />
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot</TableHead>
                    <TableHead>Bateau</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Départ</TableHead>
                    <TableHead>Arrivée est.</TableHead>
                    <TableHead>Conteneur</TableHead>
                    <TableHead>Commandes</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => {
                    const color = STATUS_COLOR[s.status] || STATUS_COLOR.pending
                    const statusLabel = SHIPMENT_STATUSES.find(st => st.value === s.status)?.label || s.status
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono font-medium text-xs">{s.batch_code}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{s.vessel_info || '—'}</TableCell>
                        <TableCell>
                          <span className={cn('text-xs font-medium rounded-full px-2 py-0.5', color)}>{statusLabel}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {s.departure_date ? new Date(s.departure_date).toLocaleDateString('fr-HT') : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {s.estimated_arrival ? new Date(s.estimated_arrival).toLocaleDateString('fr-HT') : '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{s.container_number || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{s.order_count} cmd</Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditShipment(s); setEditStatus(s.status) }}>
                                <Edit className="mr-2 h-4 w-4" />Modifier statut
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => { await loadPendingOrders(); setAssignOpen(s) }}>
                                <Package className="mr-2 h-4 w-4" />Assigner commandes
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={o => { if (!o) { setCreateOpen(false); setForm(emptyForm) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle expédition</DialogTitle>
            <DialogDescription>Créez un nouveau lot d'expédition maritime</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-3">
            {[
              { label: 'Nom du bateau', key: 'vessel_info' as const, placeholder: 'MV Atlantic Star' },
              { label: 'N° Conteneur', key: 'container_number' as const, placeholder: 'TCKU1234567' },
              { label: 'Date de départ', key: 'departure_date' as const, type: 'date' },
              { label: 'Arrivée estimée', key: 'estimated_arrival' as const, type: 'date' },
              { label: 'Poids (kg)', key: 'weight_kg' as const, type: 'number' },
              { label: 'Volume (m³)', key: 'volume_m3' as const, type: 'number' },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  type={f.type || 'text'}
                  placeholder={'placeholder' in f ? f.placeholder : undefined}
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            ))}
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Création...' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit status dialog */}
      <Dialog open={!!editShipment} onOpenChange={o => { if (!o) setEditShipment(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le statut</DialogTitle>
            <DialogDescription>Lot {editShipment?.batch_code}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>Nouveau statut</Label>
            <Select value={editStatus} onValueChange={v => setEditStatus(v as ShipmentStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SHIPMENT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditShipment(null)}>Annuler</Button>
            <Button onClick={handleStatusUpdate} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign orders dialog */}
      <Dialog open={!!assignOpen} onOpenChange={o => { if (!o) { setAssignOpen(null); setSelectedOrders([]) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assigner des commandes</DialogTitle>
            <DialogDescription>Sélectionnez les commandes payées à inclure dans le lot {assignOpen?.batch_code}</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto py-2 space-y-2">
            {pendingOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune commande payée disponible.</p>
            ) : (
              pendingOrders.map(o => (
                <label key={o.id} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:border-primary transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedOrders.includes(o.id)}
                    onChange={e => setSelectedOrders(prev => e.target.checked ? [...prev, o.id] : prev.filter(id => id !== o.id))}
                    className="rounded"
                  />
                  <div>
                    <p className="text-sm font-medium">{o.product_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{o.tracking_code}</p>
                  </div>
                  {selectedOrders.includes(o.id) && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(null)}>Annuler</Button>
            <Button onClick={handleAssignOrders} disabled={saving || selectedOrders.length === 0}>
              Assigner {selectedOrders.length > 0 ? `(${selectedOrders.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

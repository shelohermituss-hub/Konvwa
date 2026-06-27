import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  { value: 'pending',       label: 'En attente' },
  { value: 'consolidating', label: 'Consolidation' },
  { value: 'packed',        label: 'Emballé' },
  { value: 'loaded',        label: 'Chargé' },
  { value: 'sailing',       label: 'En mer' },
  { value: 'arrived',       label: 'Arrivé' },
  { value: 'cleared',       label: 'Dédouané' },
  { value: 'distributing',  label: 'Distribution' },
  { value: 'completed',     label: 'Terminé' },
]

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  pending:       { bg: 'bg-muted',       text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  consolidating: { bg: 'bg-amber-50',    text: 'text-amber-700',        dot: 'bg-amber-400' },
  packed:        { bg: 'bg-amber-50',    text: 'text-amber-700',        dot: 'bg-amber-400' },
  loaded:        { bg: 'bg-blue-50',     text: 'text-blue-700',         dot: 'bg-blue-500' },
  sailing:       { bg: 'bg-primary/10',  text: 'text-primary',          dot: 'bg-primary' },
  arrived:       { bg: 'bg-emerald-50',  text: 'text-emerald-700',      dot: 'bg-emerald-500' },
  cleared:       { bg: 'bg-emerald-50',  text: 'text-emerald-700',      dot: 'bg-emerald-500' },
  distributing:  { bg: 'bg-emerald-50',  text: 'text-emerald-700',      dot: 'bg-emerald-500' },
  completed:     { bg: 'bg-muted',       text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
}

const emptyForm = {
  vessel_info: '', container_number: '', departure_date: '',
  estimated_arrival: '', weight_kg: '', volume_m3: '', notes: '',
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
    const { data: shipmentsData } = await supabase.from('shipments').select('*').order('created_at', { ascending: false })
    if (!shipmentsData) { setLoading(false); return }

    const ids = shipmentsData.map(s => s.id)
    const { data: junctions } = await supabase.from('order_shipments').select('shipment_id').in('shipment_id', ids)
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
    if (error) toast.error("Erreur lors de l'assignation.")
    else {
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des expéditions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : `${filtered.length} expédition${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle expédition
        </Button>
      </div>

      {/* Search + table */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par code ou bateau..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Ship className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-muted-foreground">Aucune expédition</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Créez votre première expédition maritime.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Lot</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Bateau</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Statut</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Départ</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Arrivée est.</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Conteneur</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Cmds</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => {
                const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending
                const statusLabel = SHIPMENT_STATUSES.find(st => st.value === s.status)?.label || s.status
                return (
                  <TableRow key={s.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-mono font-medium text-xs">{s.batch_code}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-[120px] truncate">
                      {s.vessel_info || '—'}
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1', cfg.bg, cfg.text)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                        {statusLabel}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {s.departure_date ? new Date(s.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {s.estimated_arrival ? new Date(s.estimated_arrival).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs">{s.container_number || '—'}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold">{s.order_count}</span>
                      <span className="text-xs text-muted-foreground ml-1">cmd</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-48">
                          <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => { setEditShipment(s); setEditStatus(s.status) }}>
                            <Edit className="mr-2 h-4 w-4" />Modifier statut
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={async () => { await loadPendingOrders(); setAssignOpen(s) }}>
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
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={o => { if (!o) { setCreateOpen(false); setForm(emptyForm) } }}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle expédition</DialogTitle>
            <DialogDescription>Créez un nouveau lot d'expédition maritime</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-3">
            {[
              { label: 'Nom du bateau',    key: 'vessel_info' as const,       placeholder: 'MV Atlantic Star', type: 'text' },
              { label: 'N° Conteneur',     key: 'container_number' as const,  placeholder: 'TCKU1234567',      type: 'text' },
              { label: 'Date de départ',   key: 'departure_date' as const,    placeholder: '',                 type: 'date' },
              { label: 'Arrivée estimée',  key: 'estimated_arrival' as const, placeholder: '',                 type: 'date' },
              { label: 'Poids (kg)',       key: 'weight_kg' as const,         placeholder: '0',                type: 'number' },
              { label: 'Volume (m³)',      key: 'volume_m3' as const,         placeholder: '0',                type: 'number' },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs font-semibold">{f.label}</Label>
                <Input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="h-8 text-sm rounded-lg"
                />
              </div>
            ))}
            <div className="col-span-2 space-y-1">
              <Label className="text-xs font-semibold">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="text-sm rounded-xl resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Annuler</Button>
            <Button onClick={handleCreate} disabled={saving} className="rounded-xl">
              {saving ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit status dialog */}
      <Dialog open={!!editShipment} onOpenChange={o => { if (!o) setEditShipment(null) }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Modifier le statut</DialogTitle>
            <DialogDescription>Lot <span className="font-mono font-semibold">{editShipment?.batch_code}</span></DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label className="font-semibold text-sm">Nouveau statut</Label>
            <Select value={editStatus} onValueChange={v => setEditStatus(v as ShipmentStatus)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SHIPMENT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditShipment(null)} className="rounded-xl">Annuler</Button>
            <Button onClick={handleStatusUpdate} disabled={saving} className="rounded-xl">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign orders dialog */}
      <Dialog open={!!assignOpen} onOpenChange={o => { if (!o) { setAssignOpen(null); setSelectedOrders([]) } }}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Assigner des commandes</DialogTitle>
            <DialogDescription>
              Commandes payées à inclure dans le lot <span className="font-mono font-semibold">{assignOpen?.batch_code}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto py-2 space-y-2">
            {pendingOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune commande payée disponible.</p>
            ) : (
              pendingOrders.map(o => (
                <label key={o.id} className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                  selectedOrders.includes(o.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                )}>
                  <input
                    type="checkbox"
                    checked={selectedOrders.includes(o.id)}
                    onChange={e => setSelectedOrders(prev => e.target.checked ? [...prev, o.id] : prev.filter(id => id !== o.id))}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{o.product_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{o.tracking_code}</p>
                  </div>
                  {selectedOrders.includes(o.id) && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(null)} className="rounded-xl">Annuler</Button>
            <Button onClick={handleAssignOrders} disabled={saving || selectedOrders.length === 0} className="rounded-xl">
              Assigner {selectedOrders.length > 0 ? `(${selectedOrders.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

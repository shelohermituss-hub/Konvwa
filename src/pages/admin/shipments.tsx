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

import { tr, DATE_LOCALE } from '@/lib/i18n'
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
  cargo_count?: number
}

// Same vocabulary as order tracking (only the steps that apply to a batch)
const SHIPMENT_STATUSES: { value: ShipmentStatus; label: string }[] = [
  { value: 'in_china_warehouse', label: tr('Entrepôt (Chine)') },
  { value: 'shipped',            label: tr('Expédié') },
  { value: 'in_transit',         label: tr('En transit') },
  { value: 'arrived_haiti',      label: tr('Arrivé en Haïti') },
  { value: 'customs_processing', label: tr('Dédouanement') },
  { value: 'out_for_delivery',   label: tr('En livraison') },
  { value: 'delivered',          label: tr('Livré') },
]

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  in_china_warehouse: { bg: 'bg-sky-50',      text: 'text-sky-700',          dot: 'bg-sky-500' },
  shipped:            { bg: 'bg-blue-50',     text: 'text-blue-700',         dot: 'bg-blue-500' },
  in_transit:         { bg: 'bg-primary/10',  text: 'text-primary',          dot: 'bg-primary' },
  arrived_haiti:      { bg: 'bg-emerald-50',  text: 'text-emerald-700',      dot: 'bg-emerald-500' },
  customs_processing: { bg: 'bg-amber-50',    text: 'text-amber-700',        dot: 'bg-amber-400' },
  out_for_delivery:   { bg: 'bg-emerald-50',  text: 'text-emerald-700',      dot: 'bg-emerald-500' },
  delivered:          { bg: 'bg-muted',       text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
}

const emptyForm = {
  vessel_info: '', container_number: '', departure_date: '',
  estimated_arrival: '', weight_kg: '', volume_m3: '', notes: '',
}

interface PendingOrderRow {
  id: string
  tracking_code: string
  quotes: { product_requests: { product_name: string | null } | null } | null
}

export function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editShipment, setEditShipment] = useState<Shipment | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editStatus, setEditStatus] = useState<ShipmentStatus>('in_china_warehouse')
  const [saving, setSaving] = useState(false)
  const [assignOpen, setAssignOpen] = useState<Shipment | null>(null)
  const [pendingOrders, setPendingOrders] = useState<{ id: string; tracking_code: string; product_name: string }[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [assignCargoOpen, setAssignCargoOpen] = useState<Shipment | null>(null)
  const [pendingCargo, setPendingCargo] = useState<{ id: string; client: string; origin: string | null; paid: boolean }[]>([])
  const [selectedCargo, setSelectedCargo] = useState<string[]>([])

  async function loadShipments() {
    const { data: shipmentsData } = await supabase.from('shipments').select('*').order('created_at', { ascending: false })
    if (!shipmentsData) { setLoading(false); return }

    const ids = shipmentsData.map(s => s.id)
    const { data: junctions } = await supabase.from('order_shipments').select('shipment_id').in('shipment_id', ids)
    const countMap: Record<string, number> = {}
    ;(junctions || []).forEach(j => { countMap[j.shipment_id] = (countMap[j.shipment_id] || 0) + 1 })

    const { data: cargo } = await supabase
      .from('product_requests').select('shipment_id').in('shipment_id', ids).eq('request_type', 'shipping')
    const cargoMap: Record<string, number> = {}
    ;(cargo || []).forEach(c => { if (c.shipment_id) cargoMap[c.shipment_id] = (cargoMap[c.shipment_id] || 0) + 1 })

    setShipments(shipmentsData.map(s => ({
      ...(s as unknown as Shipment),
      order_count: countMap[s.id] || 0,
      cargo_count: cargoMap[s.id] || 0,
    })))
    setLoading(false)
  }

  async function loadPendingOrders() {
    const [{ data }, { data: assigned }] = await Promise.all([
      supabase
        .from('orders')
        .select('id, tracking_code, quotes(product_requests(product_name))')
        .in('status', ['paid', 'purchasing', 'in_china_warehouse']),
      supabase.from('order_shipments').select('order_id'),
    ])
    const assignedIds = new Set((assigned || []).map(a => a.order_id))
    if (data) {
      setPendingOrders((data as unknown as PendingOrderRow[]).filter((o) => !assignedIds.has(o.id)).map((o) => ({
        id: o.id,
        tracking_code: o.tracking_code,
        product_name: o.quotes?.product_requests?.product_name || tr('Produit'),
      })))
    }
  }

  async function loadPendingCargo() {
    const { data } = await supabase
      .from('product_requests')
      .select('id, user_id, origin_country, status')
      .eq('request_type', 'shipping')
      .in('status', ['invoiced', 'deposit_paid'])
      .is('shipment_id', null)
      .order('created_at', { ascending: false })
    const rows = data || []
    const userIds = [...new Set(rows.map(r => r.user_id))]
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
      : { data: [] as { user_id: string; full_name: string | null }[] }
    const names = Object.fromEntries((profiles || []).map(p => [p.user_id, p.full_name]))
    setPendingCargo(rows.map(r => ({
      id: r.id,
      client: names[r.user_id] || tr('Client'),
      origin: r.origin_country,
      paid: r.status === 'invoiced',
    })))
  }

  useEffect(() => { loadShipments() }, [])

  async function handleCreate() {
    setSaving(true)
    const { error } = await supabase.from('shipments').insert({
      status: 'in_china_warehouse',
      vessel_info: form.vessel_info || null,
      container_number: form.container_number || null,
      departure_date: form.departure_date || null,
      estimated_arrival: form.estimated_arrival || null,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      volume_m3: form.volume_m3 ? parseFloat(form.volume_m3) : null,
      notes: form.notes || null,
    })
    if (error) toast.error(tr('Erreur lors de la création.'))
    else { toast.success(tr('Expédition créée.')); setCreateOpen(false); setForm(emptyForm); await loadShipments() }
    setSaving(false)
  }

  async function handleStatusUpdate() {
    if (!editShipment) return
    setSaving(true)
    const { error } = await supabase.from('shipments').update({ status: editStatus, updated_at: new Date().toISOString() }).eq('id', editShipment.id)
    if (error) toast.error(tr('Erreur.'))
    else {
      const n = (editShipment.order_count ?? 0) + (editShipment.cargo_count ?? 0)
      toast.success(n > 0 ? tr('Statut mis à jour — {0} commande(s) et {1} cargaison(s) suivent automatiquement.', editShipment.order_count ?? 0, editShipment.cargo_count ?? 0) : tr('Statut mis à jour.'))
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
    if (error) toast.error(tr('Erreur lors de l\'assignation.'))
    else {
      toast.success(tr('{0} commande(s) assignée(s).', selectedOrders.length))
      setAssignOpen(null)
      setSelectedOrders([])
      await loadShipments()
    }
    setSaving(false)
  }

  async function handleAssignCargo() {
    if (!assignCargoOpen || selectedCargo.length === 0) return
    setSaving(true)
    const { error } = await supabase
      .from('product_requests')
      .update({ shipment_id: assignCargoOpen.id, updated_at: new Date().toISOString() })
      .in('id', selectedCargo)
    if (error) toast.error(tr('Erreur lors de l\'assignation.'))
    else {
      toast.success(tr('{0} cargaison(s) assignée(s).', selectedCargo.length))
      setAssignCargoOpen(null)
      setSelectedCargo([])
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
          <h1 className="text-2xl font-bold tracking-tight">{tr('Gestion des expéditions')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : tr('{0} expédition{1}', filtered.length, filtered.length !== 1 ? 's' : '')}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" />
          {tr('Nouvelle expédition')}
        </Button>
      </div>

      {/* Search + table */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tr('Rechercher par code ou bateau...')}
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
            <p className="font-semibold text-muted-foreground">{tr('Aucune expédition')}</p>
            <p className="text-xs text-muted-foreground mt-1">{tr('Créez votre première expédition maritime.')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('Lot')}</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">{tr('Bateau')}</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('Statut')}</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">{tr('Départ')}</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">{tr('Arrivée est.')}</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">{tr('Conteneur')}</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">{tr('Contenu')}</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => {
                const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.in_china_warehouse
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
                      {s.departure_date ? new Date(s.departure_date).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' }) : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {s.estimated_arrival ? new Date(s.estimated_arrival).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' }) : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs">{s.container_number || '—'}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold">{s.order_count}</span>
                      <span className="text-xs text-muted-foreground ml-1">{tr('cmd')}</span>
                      <span className="text-sm font-semibold ml-2">{s.cargo_count}</span>
                      <span className="text-xs text-muted-foreground ml-1">{tr('cargo')}</span>
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
                            <Edit className="mr-2 h-4 w-4" />{tr('Modifier statut')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={async () => { await loadPendingOrders(); setAssignOpen(s) }}>
                            <Package className="mr-2 h-4 w-4" />{tr('Assigner commandes')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={async () => { await loadPendingCargo(); setAssignCargoOpen(s) }}>
                            <Ship className="mr-2 h-4 w-4" />{tr('Assigner cargaisons')}
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
            <DialogTitle>{tr('Nouvelle expédition')}</DialogTitle>
            <DialogDescription>{tr('Créez un nouveau lot d\'expédition maritime')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-3">
            {[
              { label: tr('Nom du bateau'),    key: 'vessel_info' as const,       placeholder: 'MV Atlantic Star', type: 'text' },
              { label: tr('N° Conteneur'),     key: 'container_number' as const,  placeholder: 'TCKU1234567',      type: 'text' },
              { label: tr('Date de départ'),   key: 'departure_date' as const,    placeholder: '',                 type: 'date' },
              { label: tr('Arrivée estimée'),  key: 'estimated_arrival' as const, placeholder: '',                 type: 'date' },
              { label: tr('Poids (kg)'),       key: 'weight_kg' as const,         placeholder: '0',                type: 'number' },
              { label: tr('Volume (m³)'),      key: 'volume_m3' as const,         placeholder: '0',                type: 'number' },
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
              <Label className="text-xs font-semibold">{tr('Notes')}</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="text-sm rounded-xl resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">{tr('Annuler')}</Button>
            <Button onClick={handleCreate} disabled={saving} className="rounded-xl">
              {saving ? tr('Création...') : tr('Créer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit status dialog */}
      <Dialog open={!!editShipment} onOpenChange={o => { if (!o) setEditShipment(null) }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('Modifier le statut')}</DialogTitle>
            <DialogDescription>{tr('Lot')}{' '}<span className="font-mono font-semibold">{editShipment?.batch_code}</span></DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label className="font-semibold text-sm">{tr('Nouveau statut')}</Label>
            <Select value={editStatus} onValueChange={v => setEditStatus(v as ShipmentStatus)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SHIPMENT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground leading-relaxed pt-1">
              {editShipment && ((editShipment.order_count ?? 0) + (editShipment.cargo_count ?? 0)) > 0
                ? <>{tr('Les')}{' '}<strong>{editShipment.order_count ?? 0}{' '}{tr('commande(s)')}</strong>{' '}{tr('et')}{' '}<strong>{editShipment.cargo_count ?? 0}{' '}{tr('cargaison(s)')}</strong>{' '}{tr('assignées prendront automatiquement ce statut, et leurs clients seront notifiés aux étapes clés.')}</>
                : tr('Aucune commande ni cargaison assignée pour le moment.')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditShipment(null)} className="rounded-xl">{tr('Annuler')}</Button>
            <Button onClick={handleStatusUpdate} disabled={saving} className="rounded-xl">
              {saving ? tr('Enregistrement...') : tr('Enregistrer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign orders dialog */}
      <Dialog open={!!assignOpen} onOpenChange={o => { if (!o) { setAssignOpen(null); setSelectedOrders([]) } }}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('Assigner des commandes')}</DialogTitle>
            <DialogDescription>
              {tr('Commandes payées à inclure dans le lot')}{' '}<span className="font-mono font-semibold">{assignOpen?.batch_code}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto py-2 space-y-2">
            {pendingOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{tr('Aucune commande payée disponible.')}</p>
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
            <Button variant="outline" onClick={() => setAssignOpen(null)} className="rounded-xl">{tr('Annuler')}</Button>
            <Button onClick={handleAssignOrders} disabled={saving || selectedOrders.length === 0} className="rounded-xl">
              {tr('Assigner')}{' '}{selectedOrders.length > 0 ? `(${selectedOrders.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign cargo dialog */}
      <Dialog open={!!assignCargoOpen} onOpenChange={o => { if (!o) { setAssignCargoOpen(null); setSelectedCargo([]) } }}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('Assigner des cargaisons')}</DialogTitle>
            <DialogDescription>
              {tr('Cargaisons payées (totalement ou acompte) à inclure dans le lot')}{' '}<span className="font-mono font-semibold">{assignCargoOpen?.batch_code}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto py-2 space-y-2">
            {pendingCargo.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{tr('Aucune cargaison payée en attente d\'assignation.')}</p>
            ) : (
              pendingCargo.map(c => (
                <label key={c.id} className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                  selectedCargo.includes(c.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                )}>
                  <input
                    type="checkbox"
                    checked={selectedCargo.includes(c.id)}
                    onChange={e => setSelectedCargo(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.client}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      #{c.id.slice(0, 8).toUpperCase()}{c.origin ? ` · ${c.origin}` : ''}
                    </p>
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0',
                    c.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-teal-50 text-teal-700'
                  )}>
                    {c.paid ? tr('Payé') : tr('Acompte')}
                  </span>
                  {selectedCargo.includes(c.id) && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignCargoOpen(null)} className="rounded-xl">{tr('Annuler')}</Button>
            <Button onClick={handleAssignCargo} disabled={saving || selectedCargo.length === 0} className="rounded-xl">
              {tr('Assigner')}{' '}{selectedCargo.length > 0 ? `(${selectedCargo.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

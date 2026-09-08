import { useCallback, useEffect, useRef, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Ship, Package, MapPin, Calendar, Anchor, CheckCircle2, Clock, Truck,
  ChevronDown, ChevronUp, Plus, Trash2, Plane, Box, SendHorizonal, Loader2,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import IconNavire from 'flat-color-icons/svg/in_transit.svg'

// ── Types ────────────────────────────────────────────────────────────────────

interface MyShipment {
  shipment_id: string
  batch_code: string
  status: string
  vessel_info: string | null
  departure_date: string | null
  estimated_arrival: string | null
  actual_arrival: string | null
  container_number: string | null
  order_id: string
  order_tracking: string
  product_name: string
}

interface ShippingRequest {
  id: string
  status: string
  ship_from_id: string | null
  destination_region_id: string | null
  invoice_value_usd: number | null
  weight_kg: number | null
  packages: PackagePayload[] | null
  notes: string | null
  created_at: string
  ship_from_name?: string
  region_name?: string
}

interface PackageItem {
  id: string
  length: string
  width: string
  height: string
  weight: string
}

interface PackagePayload {
  number: number
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  weight_kg: number | null
  cbm: number | null
}

interface ShippingOrigin {
  id: string
  name: string
  flag_emoji: string
}

interface HaitiRegion {
  id: string
  name: string
}

interface HaitiCity {
  id: string
  region_id: string
  name: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const SHIPMENT_STEPS = [
  { key: 'pending',       label: 'En attente',   icon: Clock },
  { key: 'consolidating', label: 'Consolidation', icon: Package },
  { key: 'packed',        label: 'Emballé',       icon: Package },
  { key: 'loaded',        label: 'Chargé',        icon: Anchor },
  { key: 'sailing',       label: 'En mer',        icon: Ship },
  { key: 'arrived',       label: 'Arrivé',        icon: MapPin },
  { key: 'cleared',       label: 'Dédouané',      icon: CheckCircle2 },
  { key: 'distributing',  label: 'Distribution',  icon: Truck },
  { key: 'completed',     label: 'Livré',         icon: CheckCircle2 },
]

const STATUS_COLOR: Record<string, string> = {
  pending:       'bg-muted text-muted-foreground',
  consolidating: 'bg-warning/15 text-warning',
  packed:        'bg-warning/15 text-warning',
  loaded:        'bg-accent/15 text-accent',
  sailing:       'bg-primary/15 text-primary',
  arrived:       'bg-success/15 text-success',
  cleared:       'bg-success/15 text-success',
  distributing:  'bg-success/15 text-success',
  completed:     'bg-success/15 text-success',
}

const REQUEST_STATUS_COLOR: Record<string, string> = {
  submitted:  'bg-amber-50 text-amber-700',
  reviewing:  'bg-blue-50 text-blue-700',
  quoted:     'bg-primary/10 text-primary',
  accepted:   'bg-emerald-50 text-emerald-700',
  rejected:   'bg-destructive/10 text-destructive',
}
const REQUEST_STATUS_LABEL: Record<string, string> = {
  submitted:  'En attente',
  reviewing:  'En cours d'examen',
  quoted:     'Devis envoyé',
  accepted:   'Acceptée',
  rejected:   'Refusée',
}

const fmtCBM = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })

function newPkg(): PackageItem {
  return { id: crypto.randomUUID(), length: '', width: '', height: '', weight: '' }
}

// ── ShipmentCard ─────────────────────────────────────────────────────────────

function ShipmentCard({ shipment }: { shipment: MyShipment }) {
  const [expanded, setExpanded] = useState(false)
  const stepIdx = SHIPMENT_STEPS.findIndex(s => s.key === shipment.status)

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 shrink-0">
          <img src={IconNavire} alt="" className="h-8 w-8 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm font-mono">{shipment.batch_code}</p>
            <span className={cn('rounded-full text-[10px] px-2 py-0.5 font-semibold', STATUS_COLOR[shipment.status])}>
              {SHIPMENT_STEPS.find(s => s.key === shipment.status)?.label || shipment.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{shipment.product_name}</p>
          {shipment.vessel_info && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1">
              <Anchor className="h-3 w-3" />
              {shipment.vessel_info}
            </p>
          )}
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {expanded && (
        <div className="px-4 pb-5 pt-2 border-t border-border">
          <div className="flex gap-4 mb-5 text-xs">
            {shipment.departure_date && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Départ: {new Date(shipment.departure_date).toLocaleDateString('fr-HT', { day: 'numeric', month: 'short' })}</span>
              </div>
            )}
            {shipment.estimated_arrival && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>Arrivée: {new Date(shipment.estimated_arrival).toLocaleDateString('fr-HT', { day: 'numeric', month: 'short' })}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {SHIPMENT_STEPS.map((step, idx) => {
              const Icon = step.icon
              const isDone = idx < stepIdx
              const isCurrent = idx === stepIdx
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full shrink-0 transition-all',
                    isDone    ? 'bg-primary text-primary-foreground' :
                    isCurrent ? 'bg-primary/20 text-primary ring-2 ring-primary/30' :
                                'bg-muted text-muted-foreground'
                  )}>
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className={cn('text-sm', isDone || isCurrent ? 'font-medium' : 'text-muted-foreground')}>
                      {step.label}
                    </span>
                    {isCurrent && (
                      <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-semibold">Actuel</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 rounded-xl bg-muted/40 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Code commande</p>
              <p className="text-sm font-mono font-semibold">{shipment.order_tracking}</p>
            </div>
            {shipment.container_number && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Conteneur</p>
                <p className="text-sm font-mono font-semibold">{shipment.container_number}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ShippingRequestCard ───────────────────────────────────────────────────────

function ShippingRequestCard({ req }: { req: ShippingRequest }) {
  const [expanded, setExpanded] = useState(false)
  const totalCBM = (req.packages ?? []).reduce((s, p) => s + (p.cbm ?? 0), 0)

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 shrink-0">
          <Box className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm">Expédition cargo</p>
            <span className={cn(
              'rounded-full text-[10px] px-2 py-0.5 font-semibold',
              REQUEST_STATUS_COLOR[req.status] ?? 'bg-muted text-muted-foreground'
            )}>
              {REQUEST_STATUS_LABEL[req.status] ?? req.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[req.ship_from_name, req.region_name].filter(Boolean).join(' → ')}
            {totalCBM > 0 ? ` · ${fmtCBM(totalCBM)} m³` : ''}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {new Date(req.created_at).toLocaleDateString('fr-HT', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border space-y-3">
          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            {req.packages && req.packages.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                <Package className="h-3 w-3" />
                {req.packages.length} colis
              </span>
            )}
            {req.weight_kg != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                {req.weight_kg.toFixed(2)} kg
              </span>
            )}
            {totalCBM > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-semibold">
                {fmtCBM(totalCBM)} m³ CBM
              </span>
            )}
            {req.invoice_value_usd != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-semibold">
                ${req.invoice_value_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} valeur
              </span>
            )}
          </div>

          {/* Packages */}
          {req.packages && req.packages.length > 0 && (
            <div className="rounded-xl bg-[#F8F9FB] border border-gray-100 p-3 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Détail des colis</p>
              {req.packages.map((p) => (
                <div key={p.number} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Colis {p.number}</span>
                  <span className="font-mono text-foreground">
                    {[p.length_cm, p.width_cm, p.height_cm].filter(Boolean).map(v => `${v}cm`).join(' × ')}
                    {p.weight_kg ? ` · ${p.weight_kg}kg` : ''}
                    {p.cbm ? ` · ${fmtCBM(p.cbm)}m³` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {req.notes && (
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
              <p className="text-xs text-foreground">{req.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── ShippingRequestForm ───────────────────────────────────────────────────────

function ShippingRequestForm({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const { user } = useAuth()

  const [origins, setOrigins]   = useState<ShippingOrigin[]>([])
  const [regions, setRegions]   = useState<HaitiRegion[]>([])
  const [cities,  setCities]    = useState<HaitiCity[]>([])
  const [loadingRef, setLoadingRef] = useState(true)
  const [loadingCities, setLoadingCities] = useState(false)

  const [shipFromId, setShipFromId] = useState('')
  const [regionId,   setRegionId]   = useState('')
  const [cityId,     setCityId]     = useState('')
  const [invoiceUSD, setInvoiceUSD] = useState('')
  const [urgency,    setUrgency]    = useState<'normal' | 'urgent'>('normal')
  const [notes,      setNotes]      = useState('')

  const [packages, setPackages] = useState<PackageItem[]>([newPkg()])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    Promise.all([
      supabase.from('shipping_origins').select('id,name,flag_emoji').eq('active', true).order('sort_order'),
      supabase.from('haiti_regions').select('id,name').eq('active', true).order('sort_order'),
    ]).then(([originsRes, regionsRes]) => {
      setOrigins(originsRes.data as ShippingOrigin[] || [])
      setRegions(regionsRes.data as HaitiRegion[] || [])
      setLoadingRef(false)
    })
  }, [open])

  async function handleRegionChange(id: string) {
    setRegionId(id)
    setCityId('')
    setCities([])
    if (!id) return
    setLoadingCities(true)
    const { data } = await supabase
      .from('haiti_cities')
      .select('id,name,region_id')
      .eq('region_id', id)
      .eq('active', true)
      .order('sort_order')
    setCities(data as HaitiCity[] || [])
    setLoadingCities(false)
  }

  const addPackage    = useCallback(() => setPackages(prev => [...prev, newPkg()]), [])
  const removePackage = useCallback((id: string) => setPackages(prev => prev.filter(p => p.id !== id)), [])
  const updatePackage = useCallback((id: string, field: keyof Omit<PackageItem, 'id'>, value: string) => {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }, [])

  const pkgsComputed = packages.map(p => {
    const l = parseFloat(p.length) || 0
    const w = parseFloat(p.width)  || 0
    const h = parseFloat(p.height) || 0
    const wt = parseFloat(p.weight) || 0
    const cbm = l > 0 && w > 0 && h > 0 ? (l * w * h) / 1_000_000 : 0
    return { l, w, h, wt, cbm }
  })

  const totalCBM      = pkgsComputed.reduce((s, p) => s + p.cbm, 0)
  const totalWeightKg = pkgsComputed.reduce((s, p) => s + p.wt, 0)

  function resetForm() {
    setShipFromId(''); setRegionId(''); setCityId(''); setCities([])
    setInvoiceUSD(''); setUrgency('normal'); setNotes('')
    setPackages([newPkg()])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!shipFromId) { toast.error("Sélectionnez l'origine d'expédition."); return }
    if (!regionId)   { toast.error('Sélectionnez la région de destination.'); return }

    setSubmitting(true)

    const packagesPayload: PackagePayload[] = pkgsComputed
      .map((p, i) => ({
        number:    i + 1,
        length_cm: p.l  || null,
        width_cm:  p.w  || null,
        height_cm: p.h  || null,
        weight_kg: p.wt || null,
        cbm:       p.cbm || null,
      }))
      .filter(p => p.length_cm || p.weight_kg)

    const { error } = await supabase.from('product_requests').insert({
      user_id:                user.id,
      request_type:           'shipping',
      status:                 'submitted',
      product_name:           'Cargaison',
      category:               'other',
      quantity:               1,
      urgency,
      notes:                  notes || null,
      source_platform:        'other',
      ship_from_id:           shipFromId || null,
      destination_region_id:  regionId   || null,
      destination_city_id:    cityId     || null,
      weight_kg:              totalWeightKg || null,
      weight_lbs:             totalWeightKg ? totalWeightKg / 0.453592 : null,
      packages:               packagesPayload.length ? packagesPayload : null,
      unit_system:            'metric',
      invoice_value_usd:      parseFloat(invoiceUSD) || null,
    })

    if (error) {
      toast.error('Erreur lors de la soumission.')
    } else {
      toast.success('Demande envoyée !', {
        description: 'Notre équipe vous contactera sous 24h avec un tarif.',
      })
      resetForm()
      onSuccess()
      onClose()
    }
    setSubmitting(false)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="h-[92dvh] rounded-t-2xl p-0 overflow-hidden flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-left text-lg font-bold">Expédier ma cargaison</SheetTitle>
          <p className="text-sm text-muted-foreground text-left -mt-1">
            Vous avez déjà vos produits — entrez les dimensions et nous calculons le tarif.
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-5 pb-32">

            {loadingRef ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-2xl" />)}
              </div>
            ) : (
              <>
                {/* ── Route ── */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5 text-primary" />
                    Informations de route
                  </p>

                  {/* Origine */}
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">
                      Expédier depuis <span className="text-destructive">*</span>
                    </Label>
                    <Select value={shipFromId} onValueChange={setShipFromId}>
                      <SelectTrigger className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus:ring-1 focus:ring-primary/40">
                        <SelectValue placeholder="Sélectionner une origine" />
                      </SelectTrigger>
                      <SelectContent>
                        {origins.map(o => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.flag_emoji} {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Destination fixe */}
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">Expédier vers</Label>
                    <div className="h-12 rounded-2xl bg-[#F0F1F5] flex items-center px-4 gap-2.5">
                      <span className="text-lg leading-none">🇭🇹</span>
                      <span className="text-sm font-semibold text-foreground">Haïti</span>
                      <span className="ml-auto rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5">
                        Disponible
                      </span>
                    </div>
                  </div>

                  {/* Région */}
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">
                      Région <span className="text-destructive">*</span>
                    </Label>
                    <Select value={regionId} onValueChange={handleRegionChange}>
                      <SelectTrigger className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus:ring-1 focus:ring-primary/40">
                        <SelectValue placeholder="Sélectionner une région" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ville */}
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">
                      Ville <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                    </Label>
                    <Select value={cityId} onValueChange={setCityId} disabled={!regionId || loadingCities}>
                      <SelectTrigger className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus:ring-1 focus:ring-primary/40 disabled:opacity-50">
                        <SelectValue
                          placeholder={!regionId ? "Sélectionner d'abord une région" : loadingCities ? 'Chargement…' : 'Toutes les villes'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ── Colis ── */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                    <Box className="h-3.5 w-3.5 text-primary" />
                    Dimensions des colis (cm / kg)
                  </p>

                  {packages.map((pkg, idx) => {
                    const l  = parseFloat(pkg.length) || 0
                    const w  = parseFloat(pkg.width)  || 0
                    const h  = parseFloat(pkg.height) || 0
                    const cbm = l > 0 && w > 0 && h > 0 ? (l * w * h) / 1_000_000 : 0
                    return (
                      <div key={pkg.id} className="rounded-xl bg-[#F8F9FB] border border-gray-100 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Colis {idx + 1}
                          </span>
                          {packages.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePackage(pkg.id)}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 hover:bg-destructive/20 transition-colors"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          )}
                        </div>

                        {/* Dimensions L × l × H */}
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            ['L', pkg.length, 'length'],
                            ['l', pkg.width,  'width'],
                            ['H', pkg.height, 'height'],
                          ] as const).map(([lbl, val, field]) => (
                            <div key={field} className="space-y-1">
                              <span className="text-[10px] text-muted-foreground font-semibold">{lbl} (cm)</span>
                              <Input
                                type="number" inputMode="decimal" min="0" step="0.1"
                                placeholder="0.0"
                                value={val}
                                onChange={e => updatePackage(pkg.id, field, e.target.value)}
                                className="h-10 rounded-xl bg-white border border-gray-200 font-mono text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Poids */}
                        <div className="relative">
                          <span className="text-[10px] text-muted-foreground font-semibold block mb-1">Poids (kg)</span>
                          <Input
                            type="number" inputMode="decimal" min="0" step="0.01"
                            placeholder="0.00"
                            value={pkg.weight}
                            onChange={e => updatePackage(pkg.id, 'weight', e.target.value)}
                            className="h-10 rounded-xl bg-white border border-gray-200 pr-10 font-mono text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
                          />
                          <span className="absolute right-3 bottom-2.5 text-xs font-semibold text-muted-foreground">kg</span>
                        </div>

                        {cbm > 0 && (
                          <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-1.5">
                            <span className="text-[10px] font-semibold text-primary">CBM</span>
                            <span className="font-mono text-xs font-bold text-primary">{fmtCBM(cbm)} m³</span>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <button
                    type="button"
                    onClick={addPackage}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/[0.02] transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter un colis
                  </button>

                  {(totalCBM > 0 || totalWeightKg > 0) && (
                    <div className="rounded-xl bg-[#0C1413] px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9FB0AB' }}>
                          {packages.length} colis · Total
                        </p>
                        {totalWeightKg > 0 && (
                          <p className="text-xs mt-0.5" style={{ color: '#6E8882' }}>
                            {totalWeightKg.toFixed(2)} kg
                          </p>
                        )}
                      </div>
                      {totalCBM > 0 && (
                        <div className="text-right">
                          <p className="text-xs font-semibold" style={{ color: '#9FB0AB' }}>CBM total</p>
                          <p className="font-mono text-base font-bold" style={{ color: '#E6A23C' }}>
                            {fmtCBM(totalCBM)} m³
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Valeur marchande ── */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                    <Ship className="h-3.5 w-3.5 text-primary" />
                    Valeur de la cargaison
                  </p>

                  <div className="space-y-1">
                    <Label className="text-sm font-bold">
                      Valeur marchande totale (USD){' '}
                      <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">$</span>
                      <Input
                        type="number" inputMode="decimal" min="0" step="0.01"
                        placeholder="0.00"
                        value={invoiceUSD}
                        onChange={e => setInvoiceUSD(e.target.value)}
                        className="h-12 rounded-2xl bg-[#F0F1F5] border-0 pl-7 font-mono text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground px-1">
                      Valeur déclarée pour le dédouanement en Haïti
                    </p>
                  </div>

                  {/* Urgency */}
                  <div className="space-y-2">
                    <Label className="text-sm font-bold">Délai souhaité</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: 'normal', label: 'Standard', desc: 'Meilleur prix', icon: Ship },
                        { value: 'urgent', label: 'Urgent',   desc: 'Prioritaire',   icon: Plane },
                      ] as const).map(({ value, label, desc, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setUrgency(value)}
                          className={cn(
                            'flex items-center gap-2.5 rounded-2xl border-2 px-3 py-3 text-left transition-all',
                            urgency === value ? 'border-primary bg-primary/5' : 'border-gray-100 bg-[#F0F1F5]'
                          )}
                        >
                          <Icon className={cn('h-4 w-4 shrink-0', urgency === value ? 'text-primary' : 'text-muted-foreground')} />
                          <div>
                            <p className="text-sm font-semibold leading-tight">{label}</p>
                            <p className="text-[10px] text-muted-foreground">{desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">
                      Notes <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                    </Label>
                    <Textarea
                      placeholder="Précisions sur la marchandise, emballage, instructions particulières…"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                      className="rounded-2xl bg-[#F0F1F5] border-0 text-sm resize-none focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sticky CTA */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-border px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="submit"
              disabled={submitting || !shipFromId || !regionId}
              className={cn(
                'w-full rounded-2xl py-4 text-sm font-bold text-white transition-all flex items-center justify-center gap-2',
                submitting || !shipFromId || !regionId ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'
              )}
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Envoi en cours…</>
              ) : (
                <><SendHorizonal className="h-4 w-4" /> Soumettre la demande</>
              )}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ShipmentsPage() {
  const { user } = useAuth()
  const [shipments,        setShipments]        = useState<MyShipment[]>([])
  const [shippingRequests, setShippingRequests] = useState<ShippingRequest[]>([])
  const [loading,          setLoading]          = useState(true)
  const [filter,           setFilter]           = useState<'active' | 'completed'>('active')
  const [showForm,         setShowForm]         = useState(false)

  async function load() {
    if (!user) return

    const [shipmentsRes, requestsRes, originsRes, regionsRes] = await Promise.all([
      supabase
        .from('order_shipments')
        .select(`
          order_id,
          orders!inner(tracking_code, user_id, quotes(product_requests(product_name))),
          shipments(id, batch_code, status, vessel_info, departure_date, estimated_arrival, actual_arrival, container_number)
        `)
        .eq('orders.user_id', user.id),
      supabase
        .from('product_requests')
        .select('id, status, ship_from_id, destination_region_id, invoice_value_usd, weight_kg, packages, notes, created_at')
        .eq('user_id', user.id)
        .eq('request_type', 'shipping')
        .not('status', 'in', '(completed,rejected)')
        .order('created_at', { ascending: false }),
      supabase.from('shipping_origins').select('id,name,flag_emoji').eq('active', true),
      supabase.from('haiti_regions').select('id,name').eq('active', true),
    ])

    if (shipmentsRes.data) {
      setShipments(shipmentsRes.data.map((d: any) => ({
        shipment_id:      d.shipments?.id || '',
        batch_code:       d.shipments?.batch_code || '',
        status:           d.shipments?.status || 'pending',
        vessel_info:      d.shipments?.vessel_info,
        departure_date:   d.shipments?.departure_date,
        estimated_arrival: d.shipments?.estimated_arrival,
        actual_arrival:   d.shipments?.actual_arrival,
        container_number: d.shipments?.container_number,
        order_id:         d.order_id,
        order_tracking:   d.orders?.tracking_code || '',
        product_name:     d.orders?.quotes?.product_requests?.product_name || 'Produit',
      })))
    }

    if (requestsRes.data) {
      const originsMap = Object.fromEntries((originsRes.data ?? []).map((o: any) => [o.id, `${o.flag_emoji} ${o.name}`]))
      const regionsMap = Object.fromEntries((regionsRes.data ?? []).map((r: any) => [r.id, r.name]))
      setShippingRequests(requestsRes.data.map((r: any) => ({
        ...r,
        ship_from_name: r.ship_from_id ? originsMap[r.ship_from_id] : undefined,
        region_name:    r.destination_region_id ? regionsMap[r.destination_region_id] : undefined,
      })))
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const filtered = shipments.filter(s =>
    filter === 'active' ? s.status !== 'completed' : s.status === 'completed'
  )

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expéditions</h1>
          <p className="text-sm text-muted-foreground">
            {shipments.length} expédition{shipments.length !== 1 ? 's' : ''}
            {shippingRequests.length > 0 && ` · ${shippingRequests.length} demande${shippingRequests.length !== 1 ? 's' : ''} en attente`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-white transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Expédier
        </button>
      </div>

      {/* CTA card — only when no pending requests and no shipments */}
      {!loading && shippingRequests.length === 0 && shipments.length === 0 && (
        <div className="px-4 mb-4">
          <div
            className="rounded-2xl border border-primary/20 bg-white shadow-sm p-4 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
            onClick={() => setShowForm(true)}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Box className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Vous avez déjà vos produits ?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Soumettez vos dimensions — on calcule le tarif et on organise l'expédition.
              </p>
            </div>
            <Plus className="h-4 w-4 text-primary shrink-0" />
          </div>
        </div>
      )}

      {/* Pending shipping requests section */}
      {!loading && shippingRequests.length > 0 && (
        <div className="px-4 mb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 px-1 mb-2">
            Demandes d'expédition
          </p>
          <div className="space-y-2">
            {shippingRequests.map(r => (
              <ShippingRequestCard key={r.id} req={r} />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 pb-4 flex gap-2">
        {(['active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex-1 rounded-full py-2 text-sm font-semibold transition-colors border',
              filter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border'
            )}
          >
            {f === 'active' ? 'En cours' : 'Terminées'}
          </button>
        ))}
      </div>

      {/* Shipment list */}
      <div className="px-4 pb-6 space-y-3">
        {loading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
            <img src={IconNavire} alt="" className="h-12 w-12 mx-auto opacity-40 mb-3" />
            <p className="font-semibold text-muted-foreground">
              {filter === 'active' ? 'Aucune expédition en cours' : 'Aucune expédition terminée'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {filter === 'active' ? 'Vos commandes payées apparaîtront ici' : 'Les livraisons complètes apparaîtront ici'}
            </p>
          </div>
        ) : (
          filtered.map(s => <ShipmentCard key={`${s.shipment_id}-${s.order_id}`} shipment={s} />)
        )}
      </div>

      {/* Shipping request form sheet */}
      <ShippingRequestForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={load}
      />
    </div>
  )
}

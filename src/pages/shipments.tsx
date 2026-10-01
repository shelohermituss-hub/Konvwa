import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Ship, Package, MapPin, Calendar, Anchor, CheckCircle2, Clock, Truck,
  ChevronDown, ChevronUp, Plus, Loader2, Wallet, Copy, Check,
  Tag, Building2, AlertCircle, ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import IconNavire from 'flat-color-icons/svg/in_transit.svg'

// ── Types ────────────────────────────────────────────────────────────────────

interface Warehouse {
  id: string
  code: string
  name: string
  country_code: string
  flag_emoji: string | null
  address_line1: string | null
  address_line2: string | null
  address_line3: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  contact_info: string | null
  instructions: string | null
  for_category: 'generic' | 'branded' | 'usa' | 'all'
}

interface ProductRateCategory {
  id: string
  name: string
  slug: 'generic' | 'branded'
  rate_multiplier: number
  description: string | null
}

interface ShippingRequest {
  id: string
  status: string
  notes: string | null
  created_at: string
  estimated_cbm: number | null
  estimated_kg: number | null
  actual_cbm: number | null
  actual_kg: number | null
  quoted_amount_htg: number | null
  actual_amount_htg: number | null
  quoted_at: string | null
  received_at: string | null
  invoiced_at: string | null
  package_count: number | null
  origin_country: string | null
  destination_address: string | null
  shipment_id: string | null
  shipment: { id: string; batch_code: string; status: string; vessel_info: string | null; departure_date: string | null; estimated_arrival: string | null; actual_arrival: string | null; container_number: string | null } | null
  warehouse: Warehouse | null
  product_rate_category: ProductRateCategory | null
}

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

const SHIPMENT_STATUS_COLOR: Record<string, string> = {
  pending:       'bg-muted text-muted-foreground',
  consolidating: 'bg-amber-50 text-amber-700',
  packed:        'bg-amber-50 text-amber-700',
  loaded:        'bg-sky-50 text-sky-700',
  sailing:       'bg-primary/10 text-primary',
  arrived:       'bg-emerald-50 text-emerald-700',
  cleared:       'bg-emerald-50 text-emerald-700',
  distributing:  'bg-emerald-50 text-emerald-700',
  completed:     'bg-emerald-50 text-emerald-700',
}

const REQ_STATUS: Record<string, { label: string; color: string }> = {
  submitted: { label: 'En attente',    color: 'bg-amber-50 text-amber-700' },
  reviewing: { label: 'En examen',     color: 'bg-sky-50 text-sky-700' },
  quoted:    { label: 'Devis reçu',    color: 'bg-primary/10 text-primary' },
  received:  { label: 'Colis reçu',   color: 'bg-indigo-50 text-indigo-700' },
  invoiced:  { label: 'Facturé',       color: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Annulé',        color: 'bg-gray-100 text-gray-500' },
}

// ── WarehouseAddressCard ─────────────────────────────────────────────────────

function WarehouseAddressCard({ wh }: { wh: Warehouse }) {
  const [copied, setCopied] = useState(false)

  const addressLines = [
    wh.address_line1,
    wh.address_line2,
    wh.address_line3,
    [wh.city, wh.state, wh.postal_code].filter(Boolean).join(', '),
    wh.country_code === 'US' ? 'US' : null,
  ].filter(Boolean)

  const fullAddress = [
    ...(wh.contact_info ? [wh.contact_info] : []),
    ...addressLines,
  ].join('\n')

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(fullAddress)
      setCopied(true)
      toast.success('Adresse copiée')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossible de copier')
    }
  }

  const bgColor = wh.for_category === 'usa'
    ? 'bg-blue-50 border-blue-100'
    : wh.for_category === 'branded'
      ? 'bg-orange-50 border-orange-100'
      : 'bg-emerald-50 border-emerald-100'

  const categoryLabel = wh.for_category === 'usa'
    ? 'USA'
    : wh.for_category === 'branded'
      ? 'Produits marque'
      : wh.for_category === 'generic'
        ? 'Produits génériques'
        : 'Tous produits'

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className={cn('px-4 py-3 flex items-center gap-3', bgColor)}>
        <span className="text-2xl leading-none">{wh.flag_emoji ?? '🏭'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{wh.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{wh.code}</p>
        </div>
        <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-white/60 text-foreground/70 shrink-0">
          {categoryLabel}
        </span>
      </div>

      {/* Address */}
      <div className="px-4 py-3">
        {wh.contact_info && (
          <p className="text-sm font-semibold text-foreground mb-1">{wh.contact_info}</p>
        )}
        {addressLines.map((line, i) => (
          <p key={i} className="text-sm text-muted-foreground leading-snug">{line}</p>
        ))}

        {wh.instructions && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-line">{wh.instructions}</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={copyAddress}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
        >
          {copied
            ? <><Check className="h-3.5 w-3.5 text-emerald-600" /><span className="text-emerald-600">Copié !</span></>
            : <><Copy className="h-3.5 w-3.5" />Copier l'adresse</>
          }
        </button>
      </div>
    </div>
  )
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
            <span className={cn(
              'rounded-full text-[10px] px-2 py-0.5 font-semibold',
              SHIPMENT_STATUS_COLOR[shipment.status] ?? 'bg-muted text-muted-foreground'
            )}>
              {SHIPMENT_STEPS.find(s => s.key === shipment.status)?.label ?? shipment.status}
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
                Départ : {new Date(shipment.departure_date).toLocaleDateString('fr-HT', { day: 'numeric', month: 'short' })}
              </div>
            )}
            {shipment.estimated_arrival && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                Arrivée : {new Date(shipment.estimated_arrival).toLocaleDateString('fr-HT', { day: 'numeric', month: 'short' })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {SHIPMENT_STEPS.map((step, idx) => {
              const Icon = step.icon
              const isDone    = idx < stepIdx
              const isCurrent = idx === stepIdx
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full shrink-0',
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
                      <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-semibold">
                        Actuel
                      </span>
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

function ShippingRequestCard({
  req,
  walletBalance,
}: {
  req: ShippingRequest
  walletBalance: number
}) {
  const [expanded, setExpanded] = useState(false)
  const s = REQ_STATUS[req.status] ?? { label: req.status, color: 'bg-muted text-muted-foreground' }
  const displayAmount = req.actual_amount_htg ?? req.quoted_amount_htg
  const isQuoted      = req.status === 'quoted'
  const isInvoiced    = req.status === 'invoiced'
  const canPay        = isQuoted && displayAmount != null && walletBalance >= displayAmount

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl shrink-0',
          isQuoted   ? 'bg-primary/10' :
          isInvoiced ? 'bg-emerald-50' :
                       'bg-amber-50'
        )}>
          <Package className={cn(
            'h-6 w-6',
            isQuoted   ? 'text-primary' :
            isInvoiced ? 'text-emerald-600' :
                         'text-amber-600'
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('rounded-full text-[10px] px-2 py-0.5 font-semibold', s.color)}>
              {s.label}
            </span>
            {req.product_rate_category && (
              <span className={cn(
                'rounded-full text-[10px] px-2 py-0.5 font-semibold',
                req.product_rate_category.slug === 'branded'
                  ? 'bg-orange-50 text-orange-700'
                  : 'bg-sky-50 text-sky-700'
              )}>
                {req.product_rate_category.slug === 'branded' ? 'Marque' : 'Générique'}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {req.warehouse?.name ?? 'Entrepôt inconnu'}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {new Date(req.created_at).toLocaleDateString('fr-HT', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>

        {displayAmount != null ? (
          <div className="text-right shrink-0">
            <p className={cn('text-sm font-bold', isInvoiced ? 'text-emerald-600' : 'text-primary')}>
              {displayAmount.toLocaleString('fr-HT')} HTG
            </p>
            <p className="text-[10px] text-muted-foreground">{isInvoiced ? 'Payé' : 'Estimation'}</p>
          </div>
        ) : (
          expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border space-y-3">
          {/* Dimensions */}
          {(req.actual_cbm ?? req.estimated_cbm ?? req.actual_kg ?? req.estimated_kg) != null && (
            <div className="grid grid-cols-2 gap-2">
              {(req.actual_cbm ?? req.estimated_cbm) != null && (
                <div className="rounded-xl bg-[#F8F9FB] border border-gray-100 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">
                    {req.actual_cbm ? 'Volume réel' : 'Volume estimé'}
                  </p>
                  <p className="text-sm font-bold font-mono">
                    {((req.actual_cbm ?? req.estimated_cbm) as number).toFixed(4)} m³
                  </p>
                </div>
              )}
              {(req.actual_kg ?? req.estimated_kg) != null && (
                <div className="rounded-xl bg-[#F8F9FB] border border-gray-100 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">
                    {req.actual_kg ? 'Poids réel' : 'Poids estimé'}
                  </p>
                  <p className="text-sm font-bold font-mono">
                    {((req.actual_kg ?? req.estimated_kg) as number).toFixed(2)} kg
                  </p>
                </div>
              )}
            </div>
          )}

          {req.package_count != null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              {req.package_count} colis estimé{req.package_count !== 1 ? 's' : ''}
            </div>
          )}

          {req.notes && (
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
              <p className="text-xs text-foreground">{req.notes}</p>
            </div>
          )}

          {/* Quote banner */}
          {isQuoted && displayAmount != null && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">Devis reçu</p>
                <p className="text-lg font-bold text-primary">
                  {displayAmount.toLocaleString('fr-HT')} HTG
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Montant estimé. La facture finale sera établie après réception de vos colis.
              </p>
              {!canPay && (
                <Link
                  to="/wallet"
                  className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Recharger — solde insuffisant
                </Link>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-1.5">
            {req.quoted_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                Devis envoyé le {new Date(req.quoted_at).toLocaleDateString('fr-HT', { day: 'numeric', month: 'short' })}
              </div>
            )}
            {req.received_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                Colis reçu le {new Date(req.received_at).toLocaleDateString('fr-HT', { day: 'numeric', month: 'short' })}
              </div>
            )}
            {req.invoiced_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                Facturé le {new Date(req.invoiced_at).toLocaleDateString('fr-HT', { day: 'numeric', month: 'short' })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── QuoteRequestSheet ─────────────────────────────────────────────────────────

function QuoteRequestSheet({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const { user } = useAuth()
  const [warehouses,  setWarehouses]  = useState<Warehouse[]>([])
  const [categories,  setCategories]  = useState<ProductRateCategory[]>([])

  const [originCountry,      setOriginCountry]      = useState<'CN' | 'US' | ''>('')
  const [categorySlug,       setCategorySlug]       = useState<'generic' | 'branded' | ''>('')
  const [warehouseId,        setWarehouseId]        = useState('')
  const [destinationAddress, setDestinationAddress] = useState('')
  const [notes,              setNotes]              = useState('')
  const [pkgCount,           setPkgCount]           = useState('')
  const [estCbm,             setEstCbm]             = useState('')
  const [estKg,              setEstKg]              = useState('')
  const [submitting,         setSubmitting]         = useState(false)

  useEffect(() => {
    if (!open) return
    Promise.all([
      supabase.from('warehouses').select('*').eq('active', true).order('sort_order'),
      supabase.from('product_rate_categories').select('*').eq('active', true).order('sort_order'),
    ]).then(([whRes, catRes]) => {
      setWarehouses((whRes.data as Warehouse[]) ?? [])
      setCategories((catRes.data as ProductRateCategory[]) ?? [])
    })
  }, [open])

  // Auto-select warehouse based on origin + category
  useEffect(() => {
    if (!originCountry) { setWarehouseId(''); return }
    let match: Warehouse | undefined
    if (originCountry === 'US') {
      match = warehouses.find(w => w.country_code === 'US')
    } else if (originCountry === 'CN') {
      if (!categorySlug) { setWarehouseId(''); return }
      match = warehouses.find(w =>
        w.country_code === 'CN' && w.for_category === categorySlug
      )
    }
    setWarehouseId(match?.id ?? '')
  }, [originCountry, categorySlug, warehouses])

  function reset() {
    setOriginCountry('')
    setCategorySlug('')
    setWarehouseId('')
    setDestinationAddress('')
    setNotes('')
    setPkgCount('')
    setEstCbm('')
    setEstKg('')
  }

  const selectedWarehouse = warehouses.find(w => w.id === warehouseId) ?? null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!originCountry) { toast.error('Sélectionnez le pays d\'origine.'); return }
    if (originCountry === 'CN' && !categorySlug) { toast.error('Sélectionnez le type de produit.'); return }
    if (!warehouseId)  { toast.error('Aucun entrepôt disponible pour cette origine.'); return }

    setSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('request_shipping_quote', {
        p_product_category_slug: categorySlug || 'generic',
        p_warehouse_id:          warehouseId,
        p_notes:                 notes.trim() || null,
        p_package_count:         pkgCount ? parseInt(pkgCount) : null,
        p_estimated_cbm:         estCbm   ? parseFloat(estCbm)   : null,
        p_estimated_kg:          estKg    ? parseFloat(estKg)    : null,
        p_origin_country:        originCountry || null,
        p_destination_address:   destinationAddress.trim() || null,
      })
      if (error) throw error
      if (!data?.success) {
        toast.error(data?.error || 'Erreur lors de la soumission.')
        return
      }
      toast.success('Demande envoyée !', {
        description: "Notre équipe vous enverra un devis estimatif sous 24h.",
      })
      reset()
      onSuccess()
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur inconnue.')
    } finally {
      setSubmitting(false)
    }
  }


  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <SheetContent side="bottom" className="h-[92dvh] rounded-t-2xl p-0 overflow-hidden flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-left text-lg font-bold">Demander un devis d'expédition</SheetTitle>
          <p className="text-sm text-muted-foreground text-left -mt-1">
            Indiquez le type de vos produits — nous calculons une estimation et vous facturons à la réception.
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-6 pb-32">

            {/* ── Origine ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Pays d'origine <span className="text-destructive">*</span>
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {([
                  { code: 'CN', flag: '🇨🇳', label: 'Chine', sub: 'Shenzhen / Foshan' },
                  { code: 'US', flag: '🇺🇸', label: 'États-Unis', sub: 'Orlando, FL' },
                ] as const).map(o => (
                  <button
                    key={o.code}
                    type="button"
                    onClick={() => { setOriginCountry(o.code); setCategorySlug('') }}
                    className={cn(
                      'rounded-2xl border-2 p-3.5 text-left transition-all',
                      originCountry === o.code
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 bg-[#F8F9FB]'
                    )}
                  >
                    <span className="text-2xl">{o.flag}</span>
                    <p className={cn(
                      'text-sm font-bold leading-tight mt-1.5',
                      originCountry === o.code ? 'text-primary' : 'text-foreground'
                    )}>{o.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{o.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Product type (Chine only) ── */}
            {originCountry === 'CN' && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-primary" />
                Type de produit <span className="text-destructive">*</span>
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategorySlug(cat.slug)}
                    className={cn(
                      'rounded-2xl border-2 p-3.5 text-left transition-all',
                      categorySlug === cat.slug
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 bg-[#F8F9FB]'
                    )}
                  >
                    <p className={cn(
                      'text-sm font-bold leading-tight',
                      categorySlug === cat.slug ? 'text-primary' : 'text-foreground'
                    )}>
                      {cat.slug === 'generic' ? 'Générique' : 'Marque'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      {cat.description}
                    </p>
                    {cat.rate_multiplier !== 1 && (
                      <p className={cn(
                        'text-[10px] font-bold mt-1.5',
                        categorySlug === cat.slug ? 'text-primary' : 'text-muted-foreground'
                      )}>
                        +{Math.round((cat.rate_multiplier - 1) * 100)}% sur tarif standard
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* ── Suggested warehouse ── */}
            {selectedWarehouse && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2.5 border-b border-amber-200">
                  <Building2 className="h-4 w-4 text-amber-700 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Adresse de l'entrepôt</p>
                    <p className="text-xs text-amber-700">{selectedWarehouse.code}</p>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-1">
                  {selectedWarehouse.contact_info && (
                    <p className="text-sm font-semibold">{selectedWarehouse.contact_info}</p>
                  )}
                  {[selectedWarehouse.address_line1, selectedWarehouse.address_line2, selectedWarehouse.address_line3].filter(Boolean).map((l, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{l}</p>
                  ))}
                  {[selectedWarehouse.city, selectedWarehouse.state, selectedWarehouse.postal_code].filter(Boolean).length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {[selectedWarehouse.city, selectedWarehouse.state, selectedWarehouse.postal_code].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {selectedWarehouse.instructions && (
                    <div className="mt-2 pt-2 border-t border-amber-200">
                      <p className="text-[11px] text-amber-800 leading-relaxed whitespace-pre-line">
                        {selectedWarehouse.instructions}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Optional estimates ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-primary" />
                Informations optionnelles
              </p>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Nb colis</Label>
                  <Input
                    type="number" inputMode="numeric" min="1"
                    placeholder="1"
                    value={pkgCount}
                    onChange={e => setPkgCount(e.target.value)}
                    className="h-11 rounded-xl bg-[#F0F1F5] border-0 font-mono text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs font-semibold text-muted-foreground">CBM (m³)</Label>
                  <Input
                    type="number" inputMode="decimal" min="0" step="0.0001"
                    placeholder="0.00"
                    value={estCbm}
                    onChange={e => setEstCbm(e.target.value)}
                    className="h-11 rounded-xl bg-[#F0F1F5] border-0 font-mono text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Poids (kg)</Label>
                  <Input
                    type="number" inputMode="decimal" min="0" step="0.01"
                    placeholder="0.0"
                    value={estKg}
                    onChange={e => setEstKg(e.target.value)}
                    className="h-11 rounded-xl bg-[#F0F1F5] border-0 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-bold">
                  Notes <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                </Label>
                <Textarea
                  placeholder="Type de marchandise, instructions particulières, nom du fournisseur…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="rounded-2xl bg-[#F0F1F5] border-0 text-sm resize-none"
                />
              </div>
            </div>

            {/* ── Destination en Haïti ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Destination en Haïti <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground/50">(optionnel)</span>
              </p>
              <Input
                placeholder="Port-au-Prince, Pétion-Ville, Cap-Haïtien…"
                value={destinationAddress}
                onChange={e => setDestinationAddress(e.target.value)}
                className="h-11 rounded-xl bg-[#F0F1F5] border-0 text-sm"
              />
            </div>

            {/* Info note */}
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
              <p className="text-xs text-sky-800 leading-relaxed">
                Aucun paiement n'est requis maintenant. Vous recevrez un devis estimatif sous 24h.
                La facture sera établie après réception et vérification de vos colis.
              </p>
            </div>
          </div>

          {/* Sticky CTA */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-border px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="submit"
              disabled={submitting || !originCountry || (originCountry === 'CN' && !categorySlug)}
              className={cn(
                'w-full rounded-2xl py-4 text-sm font-bold text-white flex items-center justify-center gap-2 transition-all',
                submitting || !categorySlug ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'
              )}
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi en cours…</>
                : <><Package className="h-4 w-4" />Demander un devis</>
              }
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ── WarehousesSection ─────────────────────────────────────────────────────────

function WarehousesSection({ warehouses }: { warehouses: Warehouse[] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="px-4 mb-5">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-3 flex items-center gap-3 transition-colors hover:bg-muted/20"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-bold">Adresses de nos entrepôts</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Communiquez l'adresse à votre fournisseur
          </p>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {warehouses.map(wh => (
            <WarehouseAddressCard key={wh.id} wh={wh} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ShipmentsPage() {
  const { user } = useAuth()
  const [shipments,        setShipments]        = useState<MyShipment[]>([])
  const [shippingRequests, setShippingRequests] = useState<ShippingRequest[]>([])
  const [warehouses,       setWarehouses]       = useState<Warehouse[]>([])
  const [walletBalance,    setWalletBalance]    = useState(0)
  const [loading,          setLoading]          = useState(true)
  const [tab,              setTab]              = useState<'cargaisons' | 'expeditions'>('cargaisons')
  const [showForm,         setShowForm]         = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [shipmentsRes, requestsRes, warehousesRes, walletRes] = await Promise.all([
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
        .select(`
          id, status, notes, created_at,
          estimated_cbm, estimated_kg, actual_cbm, actual_kg,
          quoted_amount_htg, actual_amount_htg, quoted_at, received_at, invoiced_at,
          package_count, origin_country, destination_address, shipment_id,
          warehouse:warehouses(id, code, name, country_code, flag_emoji, address_line1, address_line2, address_line3, city, state, postal_code, contact_info, instructions, for_category),
          product_rate_category:product_rate_categories(id, name, slug, rate_multiplier, description),
          shipment:shipments(id, batch_code, status, vessel_info, departure_date, estimated_arrival, actual_arrival, container_number)
        `)
        .eq('user_id', user.id)
        .eq('request_type', 'shipping')
        .not('status', 'in', '(cancelled)')
        .order('created_at', { ascending: false }),
      supabase.from('warehouses').select('*').eq('active', true).order('sort_order'),
      supabase.from('wallets').select('available_balance').eq('user_id', user.id).maybeSingle(),
    ])

    if (shipmentsRes.data) {
      setShipments(shipmentsRes.data.map((d: any) => ({
        shipment_id:       d.shipments?.id || '',
        batch_code:        d.shipments?.batch_code || '',
        status:            d.shipments?.status || 'pending',
        vessel_info:       d.shipments?.vessel_info,
        departure_date:    d.shipments?.departure_date,
        estimated_arrival: d.shipments?.estimated_arrival,
        actual_arrival:    d.shipments?.actual_arrival,
        container_number:  d.shipments?.container_number,
        order_id:          d.order_id,
        order_tracking:    d.orders?.tracking_code || '',
        product_name:      d.orders?.quotes?.product_requests?.product_name || 'Produit',
      })))
    }

    if (requestsRes.data) {
      setShippingRequests(requestsRes.data as unknown as ShippingRequest[])
    }

    if (warehousesRes.data) {
      setWarehouses(warehousesRes.data as Warehouse[])
    }

    if (walletRes.data) setWalletBalance(walletRes.data.available_balance ?? 0)

    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // Expéditions tab: order_shipments batches + shipping-request-linked batches (deduplicated)
  const cargoLinkedShipments: MyShipment[] = shippingRequests
    .filter(r => r.shipment != null)
    .map(r => ({
      shipment_id:       r.shipment!.id,
      batch_code:        r.shipment!.batch_code,
      status:            r.shipment!.status,
      vessel_info:       r.shipment!.vessel_info,
      departure_date:    r.shipment!.departure_date,
      estimated_arrival: r.shipment!.estimated_arrival,
      actual_arrival:    r.shipment!.actual_arrival,
      container_number:  r.shipment!.container_number,
      order_id:          '',
      order_tracking:    '',
      product_name:      r.product_rate_category?.name ?? 'Cargaison',
    }))
  const allBatchIds = new Set(shipments.map(s => s.shipment_id))
  const mergedShipments = [
    ...shipments,
    ...cargoLinkedShipments.filter(s => !allBatchIds.has(s.shipment_id)),
  ]

  const hasQuoted = shippingRequests.some(r => r.status === 'quoted')

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expéditions</h1>
          <p className="text-sm text-muted-foreground">
            {shippingRequests.length} cargaison{shippingRequests.length !== 1 ? 's' : ''} · {mergedShipments.length} expédition{mergedShipments.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-white transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Demande
        </button>
      </div>

      {/* Quote notification banner */}
      {hasQuoted && (
        <div className="px-4 mb-3">
          <div className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 shrink-0">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-primary flex-1">
              Vous avez un devis en attente — vérifiez votre solde.
            </p>
            <Link to="/wallet" className="text-xs font-bold text-primary underline shrink-0">
              Portefeuille
            </Link>
          </div>
        </div>
      )}

      {/* Warehouse addresses */}
      {!loading && warehouses.length > 0 && (
        <WarehousesSection warehouses={warehouses} />
      )}

      {/* Empty CTA */}
      {!loading && shippingRequests.length === 0 && shipments.length === 0 && (
        <div className="px-4 mb-4">
          <button
            onClick={() => setShowForm(true)}
            className="w-full rounded-2xl border border-dashed border-primary/30 bg-white shadow-sm p-5 flex items-center gap-3 transition-colors hover:bg-primary/[0.02]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold">Créer une demande d'expédition</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Obtenez un devis estimatif — aucun paiement immédiat.
              </p>
            </div>
            <Plus className="h-4 w-4 text-primary shrink-0" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 pb-4 flex gap-2">
        {([
          { key: 'cargaisons',  label: 'Cargaisons',   count: shippingRequests.length },
          { key: 'expeditions', label: 'Expéditions',   count: mergedShipments.length  },
        ] as const).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 rounded-full py-2 text-sm font-semibold transition-colors border flex items-center justify-center gap-1.5',
              tab === key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border'
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                tab === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 pb-6 space-y-3">
        {loading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : tab === 'cargaisons' ? (
          <>
            {shippingRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
                <img src={IconNavire} alt="" className="h-12 w-12 mx-auto opacity-40 mb-3" />
                <p className="font-semibold text-muted-foreground">Aucune demande</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Appuyez sur + pour créer une demande</p>
              </div>
            ) : (
              shippingRequests.map(r => (
                <ShippingRequestCard key={r.id} req={r} walletBalance={walletBalance} />
              ))
            )}
          </>
        ) : (
          <>
            {mergedShipments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
                <img src={IconNavire} alt="" className="h-12 w-12 mx-auto opacity-40 mb-3" />
                <p className="font-semibold text-muted-foreground">Aucune expédition assignée</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Votre cargaison sera assignée à un batch par notre équipe
                </p>
              </div>
            ) : (
              mergedShipments.map(s => (
                <ShipmentCard key={`${s.shipment_id}-${s.order_id}`} shipment={s} />
              ))
            )}
          </>
        )}
      </div>

      <QuoteRequestSheet
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={load}
      />
    </div>
  )
}

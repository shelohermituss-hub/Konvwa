import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Package, MapPin, ChevronUp, Plus, Loader2, Copy, Check,
  Tag, AlertCircle, ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import IconNavire from 'flat-color-icons/svg/in_transit.svg'
import { cargoStatusLabel } from '@/lib/cargo-tracking'

import { tr, LOCALE_TAG, DATE_LOCALE } from '@/lib/i18n'
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
  copy_text?: string | null
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
  payment_due_at: string | null
  paid_amount_htg: number | null
  package_count: number | null
  origin_country: string | null
  destination_address: string | null
  shipment_id: string | null
  payment_plan: string | null
  shipment: { id: string; status: string } | null
  warehouse: Warehouse | null
  product_rate_category: ProductRateCategory | null
}

// ── Constants ────────────────────────────────────────────────────────────────

const REQ_STATUS: Record<string, { label: string; color: string }> = {
  submitted: { label: tr('En attente'),    color: 'bg-amber-50 text-amber-700' },
  reviewing: { label: tr('En examen'),     color: 'bg-sky-50 text-sky-700' },
  quoted:    { label: tr('Devis reçu'),    color: 'bg-primary/10 text-primary' },
  received:  { label: tr('Colis reçu'),   color: 'bg-indigo-50 text-indigo-700' },
  deposit_paid: { label: tr('Acompte payé'), color: 'bg-teal-50 text-teal-700' },
  invoiced:  { label: tr('Payé'),          color: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: tr('Annulé'),        color: 'bg-gray-100 text-gray-500' },
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

  // Admin-written full text wins: it is shown and copied exactly as written
  const customText = wh.copy_text?.trim() || null
  const fullAddress = customText ?? [
    ...(wh.contact_info ? [wh.contact_info] : []),
    ...addressLines,
  ].join('\n')

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(fullAddress)
      setCopied(true)
      toast.success(tr('Adresse copiée'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(tr('Impossible de copier'))
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
      ? tr('Produits marque')
      : wh.for_category === 'generic'
        ? tr('Produits génériques')
        : tr('Tous produits')

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className={cn('px-4 py-3 flex items-center gap-3', bgColor)}>
        <span className="text-2xl leading-none">{wh.flag_emoji ?? '🏭'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{tr(wh.name)}</p>
          <p className="text-xs text-muted-foreground font-mono">{wh.code}</p>
        </div>
        <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-white/60 text-foreground/70 shrink-0">
          {categoryLabel}
        </span>
      </div>

      {/* Address */}
      <div className="px-4 py-3">
        {customText ? (
          <div className="rounded-xl bg-muted/40 px-4 py-3 font-mono text-[13px] leading-relaxed">
            {customText.split('\n').map((line, i) => (
              <p
                key={i}
                className={cn(
                  'whitespace-pre-wrap break-words select-all',
                  /^[A-Z]{2}\d{4,}$/.test(line.trim()) || /^[A-Z]{2}$/.test(line.trim())
                    ? 'text-sky-700'
                    : 'text-foreground'
                )}
              >
                {line || '\u00A0'}
              </p>
            ))}
          </div>
        ) : (
          <>
            {wh.contact_info && (
              <p className="text-sm font-semibold text-foreground mb-1">{wh.contact_info}</p>
            )}
            {addressLines.map((line, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-snug">{line}</p>
            ))}
          </>
        )}

        {wh.instructions && !customText && (
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
            ? <><Check className="h-3.5 w-3.5 text-emerald-600" /><span className="text-emerald-600">{tr('Copié !')}</span></>
            : <><Copy className="h-3.5 w-3.5" />{tr('Copier l\'adresse')}</>
          }
        </button>
      </div>
    </div>
  )
}

// ── ShippingRequestCard ───────────────────────────────────────────────────────

function ShippingRequestCard({ req }: { req: ShippingRequest }) {
  const base = REQ_STATUS[req.status] ?? { label: req.status, color: 'bg-muted text-muted-foreground' }
  const tracked = !!req.shipment && (req.status === 'invoiced' || req.status === 'deposit_paid') && cargoStatusLabel(req) !== base.label
  const s = tracked ? { label: cargoStatusLabel(req), color: 'bg-sky-50 text-sky-700' } : base
  const displayAmount = req.actual_amount_htg ?? req.quoted_amount_htg
  const isQuoted      = req.status === 'quoted'
  const isInvoiced    = req.status === 'invoiced'
  const isDeposit     = req.status === 'deposit_paid'
  const dueAt         = req.payment_due_at ? new Date(req.payment_due_at) : null
  const lateDays      = isQuoted && dueAt && dueAt.getTime() < Date.now()
    ? Math.ceil((Date.now() - dueAt.getTime()) / 86_400_000) : 0
  const daysLeft      = isQuoted && dueAt && lateDays === 0
    ? Math.ceil((dueAt.getTime() - Date.now()) / 86_400_000) : null

  return (
    <Link
      to={`/shipments/${req.id}`}
      className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:border-primary/20 transition-colors"
    >
      <div className={cn(
        'flex h-12 w-12 items-center justify-center rounded-xl shrink-0',
        lateDays > 0 ? 'bg-red-50' :
        isQuoted   ? 'bg-primary/10' :
        isInvoiced ? 'bg-emerald-50' :
                     'bg-amber-50'
      )}>
        <img src="/icon-container.png" alt={tr('Cargaison')} className="h-8 w-8 object-contain" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('rounded-full text-[10px] px-2 py-0.5 font-semibold', s.color)}>
            {s.label}
          </span>
          {lateDays > 0 && (
            <span className="rounded-full bg-red-50 text-red-700 text-[10px] px-2 py-0.5 font-semibold">
              {tr('En retard ·')}{' '}{lateDays}{' '}{tr('j')}
            </span>
          )}
          {daysLeft !== null && daysLeft <= 5 && (
            <span className="rounded-full bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 font-semibold">
              {daysLeft}{' '}{tr('j pour payer')}
            </span>
          )}
          {req.product_rate_category && (
            <span className={cn(
              'rounded-full text-[10px] px-2 py-0.5 font-semibold',
              req.product_rate_category.slug === 'branded'
                ? 'bg-orange-50 text-orange-700'
                : 'bg-sky-50 text-sky-700'
            )}>
              {req.product_rate_category.slug === 'branded' ? tr('Marque') : tr('Générique')}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {req.warehouse?.name ?? tr('Entrepôt inconnu')}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {new Date(req.created_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1">
        {displayAmount != null ? (
          <>
            <p className={cn('text-sm font-bold', isInvoiced ? 'text-emerald-600' : lateDays > 0 ? 'text-red-600' : 'text-primary')}>
              {displayAmount.toLocaleString(LOCALE_TAG)} HTG
            </p>
            <p className="text-[10px] text-muted-foreground">
              {isInvoiced ? tr('Payé')
                : isDeposit ? tr('Reste {0}', Math.max((req.quoted_amount_htg ?? 0) - (req.paid_amount_htg ?? 0), 0).toLocaleString(LOCALE_TAG))
                : isQuoted ? tr('Officiel') : tr('Estimation')}
            </p>
          </>
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </Link>
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
    if (!originCountry) { toast.error(tr('Sélectionnez le pays d\'origine.')); return }
    if (originCountry === 'CN' && !categorySlug) { toast.error(tr('Sélectionnez le type de produit.')); return }
    if (!warehouseId)  { toast.error(tr('Aucun entrepôt disponible pour cette origine.')); return }

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
        toast.error(data?.error || tr('Erreur lors de la soumission.'))
        return
      }
      toast.success(tr('Demande envoyée !'), {
        description: tr('Notre équipe vous enverra un devis estimatif sous 24h.'),
      })
      reset()
      onSuccess()
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : tr('Erreur inconnue.'))
    } finally {
      setSubmitting(false)
    }
  }


  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <SheetContent side="bottom" className="h-[92dvh] rounded-t-2xl p-0 overflow-hidden flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-left text-lg font-bold">{tr('Demander un devis d\'expédition')}</SheetTitle>
          <p className="text-sm text-muted-foreground text-left -mt-1">
            {tr('Indiquez le type de vos produits — nous calculons une estimation et vous facturons à la réception.')}
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-6 pb-32">

            {/* ── Origine ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {tr('Pays d\'origine')}{' '}<span className="text-destructive">*</span>
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {([
                  { code: 'CN', flag: '🇨🇳', label: tr('Chine'), sub: 'Shenzhen / Foshan' },
                  { code: 'US', flag: '🇺🇸', label: tr('États-Unis'), sub: 'Orlando, FL' },
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
                {tr('Type de produit')}{' '}<span className="text-destructive">*</span>
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
                      {cat.slug === 'generic' ? tr('Générique') : tr('Marque')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      {cat.description ? tr(cat.description) : null}
                    </p>
                    {cat.rate_multiplier !== 1 && (
                      <p className={cn(
                        'text-[10px] font-bold mt-1.5',
                        categorySlug === cat.slug ? 'text-primary' : 'text-muted-foreground'
                      )}>
                        +{Math.round((cat.rate_multiplier - 1) * 100)}{tr('% sur tarif standard')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* ── Suggested warehouse: same card as the "Adresses" list (full text + copy) ── */}
            {selectedWarehouse && <WarehouseAddressCard wh={selectedWarehouse} />}

            {/* ── Optional estimates ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-primary" />
                {tr('Informations optionnelles')}
              </p>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{tr('Nb colis')}</Label>
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
                  <Label className="text-xs font-semibold text-muted-foreground">{tr('Poids (kg)')}</Label>
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
                  {tr('Notes')}{' '}<span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                </Label>
                <Textarea
                  placeholder={tr('Type de marchandise, instructions particulières, nom du fournisseur…')}
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
                {tr('Destination en Haïti')}{' '}<span className="text-xs font-normal normal-case tracking-normal text-muted-foreground/50">(optionnel)</span>
              </p>
              <Input
                placeholder={tr('Port-au-Prince, Pétion-Ville, Cap-Haïtien…')}
                value={destinationAddress}
                onChange={e => setDestinationAddress(e.target.value)}
                className="h-11 rounded-xl bg-[#F0F1F5] border-0 text-sm"
              />
            </div>

            {/* Info note */}
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
              <p className="text-xs text-sky-800 leading-relaxed">
                {tr('Aucun paiement n\'est requis maintenant. Vous recevrez un devis estimatif sous 24h. La facture sera établie après réception et vérification de vos colis.')}
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
                ? <><Loader2 className="h-4 w-4 animate-spin" />{tr('Envoi en cours…')}</>
                : <><Package className="h-4 w-4" />{tr('Demander un devis')}</>
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
          <img src="/icon-warehouse.png" alt={tr('Entrepôt')} className="h-6 w-6 object-contain" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-bold">{tr('Adresses de nos entrepôts')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tr('Communiquez l\'adresse à votre fournisseur')}
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
  const [shippingRequests, setShippingRequests] = useState<ShippingRequest[]>([])
  const [warehouses,       setWarehouses]       = useState<Warehouse[]>([])
  const [loading,          setLoading]          = useState(true)
  const [showForm,         setShowForm]         = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [requestsRes, warehousesRes] = await Promise.all([
      supabase
        .from('product_requests')
        .select(`
          id, status, notes, created_at,
          estimated_cbm, estimated_kg, actual_cbm, actual_kg,
          quoted_amount_htg, actual_amount_htg, quoted_at, received_at, invoiced_at,
          payment_due_at, paid_amount_htg,
          package_count, origin_country, destination_address, shipment_id, payment_plan,
          warehouse:warehouses(id, code, name, country_code, flag_emoji, address_line1, address_line2, address_line3, city, state, postal_code, contact_info, instructions, for_category),
          product_rate_category:product_rate_categories(id, name, slug, rate_multiplier, description),
          shipment:shipments(id, status)
        `)
        .eq('user_id', user.id)
        .eq('request_type', 'shipping')
        .not('status', 'in', '(cancelled)')
        .order('created_at', { ascending: false }),
      supabase.from('warehouses').select('*').eq('active', true).order('sort_order'),
    ])

    if (requestsRes.data) {
      setShippingRequests(requestsRes.data as unknown as ShippingRequest[])
    }

    if (warehousesRes.data) {
      setWarehouses(warehousesRes.data as Warehouse[])
    }

    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const hasQuoted = shippingRequests.some(r => r.status === 'quoted')

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr('Expéditions')}</h1>
          <p className="text-sm text-muted-foreground">
            {shippingRequests.length}{' '}{tr('cargaison')}{shippingRequests.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-white transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          {tr('Demande')}
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
              {tr('Vous avez un devis en attente — vérifiez votre solde.')}
            </p>
            <Link to="/wallet" className="text-xs font-bold text-primary underline shrink-0">
              {tr('Portefeuille')}
            </Link>
          </div>
        </div>
      )}

      {/* Warehouse addresses */}
      {!loading && warehouses.length > 0 && (
        <WarehousesSection warehouses={warehouses} />
      )}

      {/* Empty CTA */}
      {!loading && shippingRequests.length === 0 && (
        <div className="px-4 mb-4">
          <button
            onClick={() => setShowForm(true)}
            className="w-full rounded-2xl border border-dashed border-primary/30 bg-white shadow-sm p-5 flex items-center gap-3 transition-colors hover:bg-primary/[0.02]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold">{tr('Créer une demande d\'expédition')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tr('Obtenez un devis estimatif — aucun paiement immédiat.')}
              </p>
            </div>
            <Plus className="h-4 w-4 text-primary shrink-0" />
          </button>
        </div>
      )}

      {/* Cargo requests */}
      <div className="px-4 pb-6 space-y-3">
        {loading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : shippingRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
            <img src={IconNavire} alt="" className="h-12 w-12 mx-auto opacity-40 mb-3" />
            <p className="font-semibold text-muted-foreground">{tr('Aucune demande')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{tr('Appuyez sur + pour créer une demande')}</p>
          </div>
        ) : (
          shippingRequests.map(r => (
            <ShippingRequestCard key={r.id} req={r} />
          ))
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

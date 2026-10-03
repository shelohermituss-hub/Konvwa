import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Package, Clock, CheckCircle2,
  MapPin, Box, Scale, Building2,
  Download, Copy,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadShippingPDF, type ShippingRequestForPDF } from '@/lib/pdf'
import { ShippingQuotePanel, ShippingBalancePanel } from '@/components/shared/shipping-payment-panel'
import { PackagePhotos } from '@/components/shared/package-photos'
import { ShippingInsurance } from '@/components/shared/shipping-insurance'
import { TimelineList } from '@/components/shared/timeline-step'
import { cargoSteps, cargoActiveIndex, cargoStatusLabel } from '@/lib/cargo-tracking'

import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'
// ── Types ─────────────────────────────────────────────────────────────────────

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
  payment_plan: string | null
  insured: boolean
  insured_value_usd: number | null
  insurance_fee_htg: number | null
  shipment: { id: string; status: string } | null
  warehouse: {
    id: string; code: string; name: string
    flag_emoji: string | null; country_code: string
    address_line1: string | null
    address_line2: string | null
    address_line3: string | null
    city: string | null
    state: string | null
    postal_code: string | null
    contact_info: string | null
    instructions: string | null
  } | null
  product_rate_category: {
    id: string; name: string; slug: string; rate_multiplier: number
  } | null
}

// ── Status presentation ───────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  submitted:    'bg-amber-50 text-amber-700 border-amber-200',
  reviewing:    'bg-sky-50 text-sky-700 border-sky-200',
  received:     'bg-indigo-50 text-indigo-700 border-indigo-200',
  quoted:       'bg-orange-50 text-orange-700 border-orange-200',
  deposit_paid: 'bg-teal-50 text-teal-700 border-teal-200',
  invoiced:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled:    'bg-gray-100 text-gray-500 border-gray-200',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [req,           setReq]           = useState<ShippingRequest | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [walletBalance, setWalletBalance] = useState(0)

  async function load() {
    if (!user || !id) return
    const [reqRes, walletRes] = await Promise.all([
      supabase
        .from('product_requests')
        .select(`
          id, status, notes, created_at,
          estimated_cbm, estimated_kg, actual_cbm, actual_kg,
          quoted_amount_htg, actual_amount_htg,
          quoted_at, received_at, invoiced_at, package_count,
          origin_country, destination_address, shipment_id, payment_plan,
          insured, insured_value_usd, insurance_fee_htg,
          warehouse:warehouses(
            id, code, name, flag_emoji, country_code,
            address_line1, address_line2, address_line3,
            city, state, postal_code, contact_info, instructions
          ),
          product_rate_category:product_rate_categories(id, name, slug, rate_multiplier),
          shipment:shipments(id, status)
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('request_type', 'shipping')
        .single(),
      supabase
        .from('wallets')
        .select('available_balance')
        .eq('user_id', user.id)
        .single(),
    ])

    setLoading(false)
    if (reqRes.error || !reqRes.data) {
      toast.error(tr('Demande introuvable'))
      navigate('/shipments')
      return
    }
    setReq(reqRes.data as unknown as ShippingRequest)
    if (walletRes.data) setWalletBalance(walletRes.data.available_balance ?? 0)
  }

  useEffect(() => { load() }, [user, id])

  async function handleDownloadPDF() {
    if (!req) return
    await downloadShippingPDF(req as unknown as ShippingRequestForPDF)
  }

  if (loading) {
    return (
      <div className="min-h-full bg-[#F4F5F7] px-4 py-6 space-y-4">
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    )
  }

  if (!req) return null

  const displayAmount = req.actual_amount_htg ?? req.quoted_amount_htg
  const isQuoted      = req.status === 'quoted'
  const isInvoiced    = req.status === 'invoiced'
  const isDeposit     = req.status === 'deposit_paid'

  return (
    <div className="min-h-full bg-[#F4F5F7] pb-10">

      {/* Sticky header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/shipments')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 shrink-0 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-foreground">{tr('Demande d\'expédition')}</h1>
              <span className={cn(
                'rounded-full px-3 py-0.5 text-xs font-semibold border shrink-0',
                (req.shipment && (req.status === 'invoiced' || req.status === 'deposit_paid') && cargoStatusLabel(req) !== (req.status === 'invoiced' ? 'Payé' : 'Acompte payé'))
                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                  : STATUS_BADGE[req.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'
              )}>
                {cargoStatusLabel(req)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{req.id.slice(0, 8).toUpperCase()}</p>
          </div>
          {(isQuoted || isInvoiced || isDeposit) && (
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border border-primary/20 text-primary bg-white hover:bg-primary/5 shadow-sm transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* Contextual banners */}
        {(req.status === 'submitted' || req.status === 'reviewing') && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
            <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">
              {tr('Envoyez vos colis à l\'adresse de l\'entrepôt ci-dessous. Votre devis officiel sera établi à leur arrivée.')}
            </p>
          </div>
        )}
        {req.status === 'received' && (
          <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-start gap-3">
            <Package className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-sm text-indigo-800 leading-relaxed">
              {tr('Vos colis sont bien arrivés à notre entrepôt. Votre devis officiel est en cours de préparation.')}
            </p>
          </div>
        )}
        {isInvoiced && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">
              {tr('Paiement confirmé —')}{' '}
              {(req.actual_amount_htg ?? req.quoted_amount_htg ?? 0).toLocaleString(LOCALE_TAG)}{' '}{tr('HTG.')}{' '}
              {req.shipment
                ? <>{tr('Statut actuel de votre cargaison :')}{' '}<strong>{cargoStatusLabel(req)}</strong>.</>
                : tr('Votre cargaison sera assignée à une prochaine expédition.')}
            </p>
          </div>
        )}

        {/* Warehouse address */}
        {req.warehouse && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50/60 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <img
                  src="/icon-warehouse.png"
                  alt={tr('Entrepôt')}
                  className="h-10 w-10 object-contain shrink-0"
                />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700/70">
                    {tr('Adresse de l\'entrepôt')}
                  </p>
                  <p className="text-sm font-bold text-foreground mt-0.5">
                    {req.warehouse.flag_emoji} {tr(req.warehouse.name)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const parts = [
                    req.warehouse!.name,
                    req.warehouse!.address_line1,
                    req.warehouse!.address_line2,
                    req.warehouse!.address_line3,
                    [req.warehouse!.city, req.warehouse!.state, req.warehouse!.postal_code]
                      .filter(Boolean).join(', '),
                    req.warehouse!.contact_info,
                  ].filter(Boolean) as string[]
                  navigator.clipboard.writeText(parts.join('\n'))
                    .then(() => toast.success(tr('Adresse copiée')))
                    .catch(() => toast.error(tr('Impossible de copier')))
                }}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-100 hover:bg-sky-200 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                {tr('Copier')}
              </button>
            </div>
            {(req.warehouse.address_line1 || req.warehouse.city) ? (
              <div className="text-sm text-foreground space-y-0.5">
                {req.warehouse.address_line1 && <p>{req.warehouse.address_line1}</p>}
                {req.warehouse.address_line2 && <p>{req.warehouse.address_line2}</p>}
                {req.warehouse.address_line3 && <p>{req.warehouse.address_line3}</p>}
                {(req.warehouse.city || req.warehouse.state || req.warehouse.postal_code) && (
                  <p>
                    {[req.warehouse.city, req.warehouse.state, req.warehouse.postal_code]
                      .filter(Boolean).join(', ')}
                  </p>
                )}
                {req.warehouse.contact_info && (
                  <p className="text-muted-foreground pt-1 text-xs">{req.warehouse.contact_info}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {tr('Adresse complète disponible après confirmation')}
              </p>
            )}
            {req.warehouse.instructions && (
              <div className="mt-3 rounded-xl bg-sky-100/70 px-3 py-2">
                <p className="text-xs text-sky-800 leading-relaxed">{req.warehouse.instructions}</p>
              </div>
            )}
          </div>
        )}

        <PackagePhotos requestId={req.id} hideWhenEmpty />

        {['quoted', 'received', 'deposit_paid'].includes(req.status) && (
          <ShippingInsurance requestId={req.id} insured={req.insured} insuredValueUsd={req.insured_value_usd}
            feeHtg={req.insurance_fee_htg} onChange={() => void load()} />
        )}

        {/* Estimation indicative — only for pre-quote stages */}
        {!isQuoted && !isInvoiced && !isDeposit && (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              {tr('Estimation indicative')}
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold text-foreground">
                {displayAmount != null
                  ? `${displayAmount.toLocaleString(LOCALE_TAG)} HTG`
                  : '—'
                }
              </p>
              <span className="shrink-0 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2.5 py-1 font-semibold">
                {tr('Peut changer')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {displayAmount != null
                ? tr('Estimation provisoire — le montant final peut varier selon le poids et volume réels')
                : tr('Le devis sera calculé à réception et pesée de vos colis')
              }
            </p>
          </div>
        )}

        {/* Quote / pay section */}
        {isQuoted && displayAmount != null && (
          <ShippingQuotePanel requestId={req.id} walletBalance={walletBalance} onPaid={load} />
        )}

        {/* Deposit paid: balance due at delivery */}
        {isDeposit && (
          <ShippingBalancePanel requestId={req.id} walletBalance={walletBalance} onPaid={load} />
        )}

        {/* Paid amount */}
        {isInvoiced && displayAmount != null && (
          <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm p-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{tr('Montant payé')}</p>
            <p className="text-xl font-bold text-emerald-700">
              {displayAmount.toLocaleString(LOCALE_TAG)} HTG
            </p>
          </div>
        )}

        {/* Details */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{tr('Détails')}</p>
          <div className="divide-y divide-border/40">
            {req.warehouse && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />{tr('Entrepôt')}
                </span>
                <span className="text-sm font-semibold">
                  {req.warehouse.flag_emoji} {tr(req.warehouse.name)}
                </span>
              </div>
            )}
            {req.product_rate_category && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground">{tr('Type de produit')}</span>
                <span className="text-sm font-semibold">{tr(req.product_rate_category.name)}</span>
              </div>
            )}
            {req.origin_country && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />{tr('Origine')}
                </span>
                <span className="text-sm font-semibold">
                  {req.origin_country === 'CN' ? tr('🇨🇳 Chine') :
                   req.origin_country === 'US' ? tr('🇺🇸 États-Unis') : req.origin_country}
                </span>
              </div>
            )}
            {req.package_count != null && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Box className="h-3.5 w-3.5" />{tr('Colis')}
                </span>
                <span className="text-sm font-semibold">{req.package_count}</span>
              </div>
            )}
            {(req.actual_cbm ?? req.estimated_cbm) != null && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground">{tr('Volume')}</span>
                <span className="text-sm font-semibold font-mono">
                  {((req.actual_cbm ?? req.estimated_cbm) as number).toFixed(4)} m³
                  {!req.actual_cbm && <span className="text-muted-foreground font-sans font-normal text-xs"> (est.)</span>}
                </span>
              </div>
            )}
            {(req.actual_kg ?? req.estimated_kg) != null && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5" />{tr('Poids')}
                </span>
                <span className="text-sm font-semibold font-mono">
                  {((req.actual_kg ?? req.estimated_kg) as number).toFixed(2)} kg
                  {!req.actual_kg && <span className="text-muted-foreground font-sans font-normal text-xs"> (est.)</span>}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-muted-foreground">{tr('Soumis le')}</span>
              <span className="text-sm font-semibold">
                {new Date(req.created_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Tracking — same statuses as order tracking */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-bold text-foreground">{tr('Suivi de la cargaison')}</p>
          </div>
          <div className="px-4 py-4">
            <TimelineList steps={cargoSteps(req)} currentIndex={cargoActiveIndex(req)} />
          </div>
        </div>

        {/* Notes */}
        {req.notes && (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{tr('Notes')}</p>
            <p className="text-sm text-foreground leading-relaxed">{req.notes}</p>
          </div>
        )}

        {/* Timeline */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{tr('Historique')}</p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
              {tr('Demande soumise le')}{' '}{new Date(req.created_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            {req.received_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                {tr('Colis reçus le')}{' '}{new Date(req.received_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
            {req.quoted_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {tr('Devis envoyé le')}{' '}{new Date(req.quoted_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
            {req.invoiced_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                {tr('Payé le')}{' '}{new Date(req.invoiced_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>

        {/* Support */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">{tr('Besoin d\'aide ?')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{tr('Notre équipe est disponible')}</p>
          </div>
          <Link
            to="/support"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold shadow-sm hover:bg-muted/50 transition-colors"
          >
            {tr('Contacter')}
          </Link>
        </div>

      </div>
    </div>
  )
}

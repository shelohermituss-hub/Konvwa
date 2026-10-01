import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Package, Clock, CheckCircle2, Wallet, Loader2,
  Ship, MapPin, Anchor, Box, Scale, Building2,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

// ── Types ────────────────────────────────────────────────────────────────────

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
  shipment: {
    id: string
    batch_code: string
    status: string
    vessel_info: string | null
    departure_date: string | null
    estimated_arrival: string | null
    actual_arrival: string | null
    container_number: string | null
  } | null
  warehouse: {
    id: string; code: string; name: string
    flag_emoji: string | null; country_code: string
  } | null
  product_rate_category: {
    id: string; name: string; slug: string; rate_multiplier: number
  } | null
}

// ── Constants ────────────────────────────────────────────────────────────────

const REQ_STEPS = [
  { key: 'submitted', label: 'Demande soumise' },
  { key: 'reviewing', label: 'En examen' },
  { key: 'received',  label: 'Colis reçus' },
  { key: 'quoted',    label: 'Devis officiel' },
  { key: 'invoiced',  label: 'Payé' },
]

const STATUS_ORDER = ['submitted', 'reviewing', 'received', 'quoted', 'invoiced']

const SHIPMENT_STEPS = [
  { key: 'pending',       label: 'En attente' },
  { key: 'consolidating', label: 'Consolidation' },
  { key: 'packed',        label: 'Emballé' },
  { key: 'loaded',        label: 'Chargé' },
  { key: 'sailing',       label: 'En mer' },
  { key: 'arrived',       label: 'Arrivé' },
  { key: 'cleared',       label: 'Dédouané' },
  { key: 'distributing',  label: 'Distribution' },
  { key: 'completed',     label: 'Livré' },
]

const STATUS_BADGE: Record<string, string> = {
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  reviewing: 'bg-sky-50 text-sky-700 border-sky-200',
  received:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  quoted:    'bg-orange-50 text-orange-700 border-orange-200',
  invoiced:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Soumis',
  reviewing: 'En examen',
  received:  'Colis reçus',
  quoted:    'Devis reçu',
  invoiced:  'Payé',
  cancelled: 'Annulé',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [req,           setReq]           = useState<ShippingRequest | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [walletBalance, setWalletBalance] = useState(0)
  const [paying,        setPaying]        = useState(false)

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
          origin_country, destination_address, shipment_id,
          warehouse:warehouses(id, code, name, flag_emoji, country_code),
          product_rate_category:product_rate_categories(id, name, slug, rate_multiplier),
          shipment:shipments(id, batch_code, status, vessel_info, departure_date, estimated_arrival, actual_arrival, container_number)
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
      toast.error('Demande introuvable')
      navigate('/shipments')
      return
    }
    setReq(reqRes.data as unknown as ShippingRequest)
    if (walletRes.data) setWalletBalance(walletRes.data.available_balance ?? 0)
  }

  useEffect(() => { load() }, [user, id])

  async function handlePay() {
    if (!req) return
    setPaying(true)
    const { data, error } = await supabase.rpc('pay_shipping_quote', { p_request_id: req.id })
    setPaying(false)
    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? 'Erreur de paiement')
      return
    }
    toast.success(`${(req.quoted_amount_htg ?? 0).toLocaleString('fr-HT')} HTG débités — paiement confirmé`)
    load()
  }

  if (loading) {
    return (
      <div className="min-h-full bg-[#F4F5F7] px-4 py-6 space-y-4">
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    )
  }

  if (!req) return null

  const statusIdx    = STATUS_ORDER.indexOf(req.status)
  const displayAmount = req.actual_amount_htg ?? req.quoted_amount_htg
  const isQuoted     = req.status === 'quoted'
  const isInvoiced   = req.status === 'invoiced'
  const canPay       = isQuoted && displayAmount != null && walletBalance >= displayAmount

  return (
    <div className="min-h-full bg-[#F4F5F7] pb-10">

      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/shipments')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold">Demande d'expédition</h1>
          <p className="text-xs text-muted-foreground font-mono">{req.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <span className={cn(
          'rounded-full px-3 py-1 text-xs font-semibold border shrink-0',
          STATUS_BADGE[req.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'
        )}>
          {STATUS_LABEL[req.status] ?? req.status}
        </span>
      </div>

      <div className="px-4 space-y-4">

        {/* Status stepper */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-4">Suivi de la demande</p>
          <div className="space-y-3">
            {REQ_STEPS.map((step, idx) => {
              const isDone    = idx < statusIdx
              const isCurrent = idx === statusIdx
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full shrink-0 transition-colors',
                    isDone    ? 'bg-primary text-white' :
                    isCurrent ? 'bg-primary/15 text-primary ring-2 ring-primary/25' :
                                'bg-muted text-muted-foreground'
                  )}>
                    {isDone
                      ? <CheckCircle2 className="h-4 w-4" />
                      : <span className="text-[10px] font-bold">{idx + 1}</span>
                    }
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className={cn('text-sm', isDone || isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
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
        </div>

        {/* Contextual banners */}
        {(req.status === 'submitted' || req.status === 'reviewing') && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
            <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">
              Envoyez vos colis à l'adresse de notre entrepôt.
              Votre devis officiel sera établi à leur arrivée.
            </p>
          </div>
        )}
        {req.status === 'received' && (
          <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-start gap-3">
            <Package className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-sm text-indigo-800 leading-relaxed">
              Vos colis sont bien arrivés à notre entrepôt.
              Votre devis officiel est en cours de préparation.
            </p>
          </div>
        )}
        {isInvoiced && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">
              Paiement confirmé —{' '}
              {(req.actual_amount_htg ?? req.quoted_amount_htg ?? 0).toLocaleString('fr-HT')} HTG.
              Votre cargaison sera assignée à une prochaine expédition.
            </p>
          </div>
        )}

        {/* Quote / pay section */}
        {isQuoted && displayAmount != null && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-foreground">Devis officiel</p>
              <p className="text-xl font-bold text-primary">
                {displayAmount.toLocaleString('fr-HT')} HTG
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Devis établi après réception de vos colis. Réglez maintenant pour confirmer votre expédition.
            </p>
            {canPay ? (
              <button
                type="button"
                onClick={handlePay}
                disabled={paying}
                className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
              >
                {paying
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Paiement en cours…</>
                  : <><Wallet className="h-4 w-4" />Payer {displayAmount.toLocaleString('fr-HT')} HTG</>
                }
              </button>
            ) : (
              <Link
                to="/wallet"
                className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
              >
                <Wallet className="h-4 w-4" />
                Recharger — solde insuffisant
              </Link>
            )}
          </div>
        )}

        {/* Paid amount */}
        {isInvoiced && displayAmount != null && (
          <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm p-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Montant payé</p>
            <p className="text-xl font-bold text-emerald-600">
              {displayAmount.toLocaleString('fr-HT')} HTG
            </p>
          </div>
        )}

        {/* Details */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Détails</p>
          <div className="divide-y divide-border/40">
            {req.warehouse && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />Entrepôt
                </span>
                <span className="text-sm font-semibold">
                  {req.warehouse.flag_emoji} {req.warehouse.name}
                </span>
              </div>
            )}
            {req.product_rate_category && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground">Type de produit</span>
                <span className="text-sm font-semibold">{req.product_rate_category.name}</span>
              </div>
            )}
            {req.origin_country && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />Origine
                </span>
                <span className="text-sm font-semibold">
                  {req.origin_country === 'CN' ? '🇨🇳 Chine' :
                   req.origin_country === 'US' ? '🇺🇸 États-Unis' : req.origin_country}
                </span>
              </div>
            )}
            {req.package_count != null && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Box className="h-3.5 w-3.5" />Colis
                </span>
                <span className="text-sm font-semibold">{req.package_count}</span>
              </div>
            )}
            {(req.actual_cbm ?? req.estimated_cbm) != null && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground">Volume</span>
                <span className="text-sm font-semibold font-mono">
                  {((req.actual_cbm ?? req.estimated_cbm) as number).toFixed(4)} m³
                  {!req.actual_cbm && <span className="text-muted-foreground font-sans font-normal text-xs"> (est.)</span>}
                </span>
              </div>
            )}
            {(req.actual_kg ?? req.estimated_kg) != null && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5" />Poids
                </span>
                <span className="text-sm font-semibold font-mono">
                  {((req.actual_kg ?? req.estimated_kg) as number).toFixed(2)} kg
                  {!req.actual_kg && <span className="text-muted-foreground font-sans font-normal text-xs"> (est.)</span>}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-muted-foreground">Soumis le</span>
              <span className="text-sm font-semibold">
                {new Date(req.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {req.notes && (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Notes</p>
            <p className="text-sm text-foreground leading-relaxed">{req.notes}</p>
          </div>
        )}

        {/* Shipment tracking */}
        {req.shipment && (() => {
          const shipmentStepIdx = SHIPMENT_STEPS.findIndex(s => s.key === req.shipment!.status)
          return (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Expédition</p>
                <div className="flex items-center gap-2">
                  <Ship className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-sm font-bold">{req.shipment!.batch_code}</span>
                </div>
              </div>
              <div className="px-4 py-4 space-y-4">
                {(req.shipment!.departure_date || req.shipment!.estimated_arrival) && (
                  <div className="flex gap-6">
                    {req.shipment!.departure_date && (
                      <div>
                        <p className="text-[10px] text-muted-foreground">Départ</p>
                        <p className="text-sm font-semibold">
                          {new Date(req.shipment!.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    )}
                    {req.shipment!.estimated_arrival && (
                      <div>
                        <p className="text-[10px] text-muted-foreground">Arrivée estimée</p>
                        <p className="text-sm font-semibold">
                          {new Date(req.shipment!.estimated_arrival).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {req.shipment!.vessel_info && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Anchor className="h-3.5 w-3.5" />
                    {req.shipment!.vessel_info}
                  </div>
                )}
                <div className="space-y-2.5">
                  {SHIPMENT_STEPS.map((step, idx) => {
                    const isDone    = idx < shipmentStepIdx
                    const isCurrent = idx === shipmentStepIdx
                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        <div className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full shrink-0',
                          isDone    ? 'bg-primary text-white' :
                          isCurrent ? 'bg-primary/15 text-primary ring-2 ring-primary/25' :
                                      'bg-muted text-muted-foreground'
                        )}>
                          {isDone
                            ? <CheckCircle2 className="h-3.5 w-3.5" />
                            : <span className="text-[9px] font-bold">{idx + 1}</span>
                          }
                        </div>
                        <div className="flex-1 flex items-center justify-between">
                          <span className={cn('text-xs', isDone || isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                            {step.label}
                          </span>
                          {isCurrent && (
                            <span className="bg-primary/10 text-primary text-[9px] px-2 py-0.5 rounded-full font-semibold">
                              Actuel
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {req.shipment!.container_number && (
                  <div className="rounded-xl bg-muted/40 px-3 py-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">N° conteneur</p>
                    <p className="text-sm font-mono font-semibold">{req.shipment!.container_number}</p>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Timeline */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Historique</p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
              Demande soumise le {new Date(req.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            {req.received_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                Colis reçus le {new Date(req.received_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
            {req.quoted_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                Devis envoyé le {new Date(req.quoted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
            {req.invoiced_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                Payé le {new Date(req.invoiced_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Package, Loader2, ChevronDown, ChevronUp, Warehouse,
  CheckCheck, FileText, Receipt, Scale, Box
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShippingRequest {
  id: string
  status: string
  notes: string | null
  created_at: string
  updated_at: string
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
  admin_notes: string | null
  user_id: string
  profiles: { full_name: string | null; phone: string | null } | null
  warehouse: {
    id: string; code: string; name: string; flag_emoji: string | null
    country_code: string
  } | null
  product_rate_category: {
    id: string; name: string; slug: string; rate_multiplier: number
  } | null
}

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Soumis',
  reviewing: 'En révision',
  quoted:    'Devis envoyé',
  received:  'Reçu en entrepôt',
  invoiced:  'Facturé',
  cancelled: 'Annulé',
}

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  reviewing: 'bg-sky-50 text-sky-700 border-sky-200',
  quoted:    'bg-orange-50 text-orange-700 border-orange-200',
  received:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  invoiced:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

const BTN_ORANGE = { background: 'linear-gradient(135deg, #F05A28, #D44E21)', color: '#fff' }

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-HT').format(n)
}

function fmtDate(s: string | null | undefined) {
  if (!s) return null
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Action sheet ──────────────────────────────────────────────────────────────

function AdminActionSheet({
  request,
  onClose,
  onDone,
}: {
  request: ShippingRequest
  onClose: () => void
  onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    actual_cbm:        String(request.actual_cbm ?? request.estimated_cbm ?? ''),
    actual_kg:         String(request.actual_kg  ?? request.estimated_kg  ?? ''),
    quoted_amount_htg: String(request.quoted_amount_htg ?? ''),
    final_amount_htg:  String(request.actual_amount_htg ?? request.quoted_amount_htg ?? ''),
    admin_notes:       request.admin_notes ?? '',
  })

  async function handleMarkReviewing() {
    setSaving(true)
    const { error } = await supabase.from('product_requests')
      .update({ status: 'reviewing', updated_at: new Date().toISOString() })
      .eq('id', request.id)
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    toast.success('Demande marquée en révision')
    onDone()
  }

  async function handleSendQuote() {
    if (!form.actual_cbm || !form.actual_kg || !form.quoted_amount_htg) {
      toast.error('CBM, poids et montant du devis sont obligatoires')
      return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('admin_send_shipping_quote', {
      p_request_id:        request.id,
      p_actual_cbm:        parseFloat(form.actual_cbm),
      p_actual_kg:         parseFloat(form.actual_kg),
      p_quoted_amount_htg: parseFloat(form.quoted_amount_htg),
      p_admin_notes:       form.admin_notes || null,
    })
    setSaving(false)
    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? 'Erreur')
      return
    }
    toast.success('Devis envoyé au client')
    onDone()
  }

  async function handleMarkReceived() {
    setSaving(true)
    const { data, error } = await supabase.rpc('admin_mark_shipping_received', {
      p_request_id:  request.id,
      p_admin_notes: form.admin_notes || null,
    })
    setSaving(false)
    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? 'Erreur')
      return
    }
    toast.success('Colis marqué reçu en entrepôt')
    onDone()
  }

  async function handleInvoice() {
    if (!form.final_amount_htg) {
      toast.error('Montant final obligatoire')
      return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('admin_invoice_shipment', {
      p_request_id:       request.id,
      p_final_amount_htg: parseFloat(form.final_amount_htg),
    })
    setSaving(false)
    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? 'Erreur')
      return
    }
    toast.success(`${fmt(data.amount_htg)} HTG débités`)
    onDone()
  }

  const s = request.status

  return (
    <Sheet open onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">
            Demande #{request.id.slice(0, 8).toUpperCase()}
          </SheetTitle>
        </SheetHeader>

        <div className="py-5 space-y-5">
          {/* Client info */}
          <div className="rounded-xl bg-gray-50 p-3.5 space-y-1 text-sm">
            <p className="font-semibold">{request.profiles?.full_name ?? 'Client inconnu'}</p>
            {request.profiles?.phone && <p className="text-muted-foreground">{request.profiles.phone}</p>}
            <p className="text-muted-foreground">
              {request.product_rate_category?.name ?? '—'} ·{' '}
              {request.warehouse?.flag_emoji} {request.warehouse?.name ?? '—'}
            </p>
            <p className="text-muted-foreground">Créé le {fmtDate(request.created_at)}</p>
            {request.notes && <p className="text-muted-foreground italic">"{request.notes}"</p>}
          </div>

          {/* Dimensions */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Dimensions</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">CBM réel (m³)</Label>
                <Input
                  type="number" step="0.001" placeholder="0.500"
                  value={form.actual_cbm}
                  onChange={e => setForm(p => ({ ...p, actual_cbm: e.target.value }))}
                  className="rounded-xl"
                  disabled={s === 'invoiced' || s === 'cancelled'}
                />
                {request.estimated_cbm != null && (
                  <p className="text-[10px] text-muted-foreground">Estimé: {request.estimated_cbm} m³</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Poids réel (kg)</Label>
                <Input
                  type="number" step="0.1" placeholder="5.0"
                  value={form.actual_kg}
                  onChange={e => setForm(p => ({ ...p, actual_kg: e.target.value }))}
                  className="rounded-xl"
                  disabled={s === 'invoiced' || s === 'cancelled'}
                />
                {request.estimated_kg != null && (
                  <p className="text-[10px] text-muted-foreground">Estimé: {request.estimated_kg} kg</p>
                )}
              </div>
            </div>
          </div>

          {/* Quote amount */}
          {(s === 'submitted' || s === 'reviewing') && (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Montant du devis (HTG)</Label>
              <Input
                type="number" step="1" placeholder="12 000"
                value={form.quoted_amount_htg}
                onChange={e => setForm(p => ({ ...p, quoted_amount_htg: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          )}

          {/* Invoice amount */}
          {s === 'received' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Montant final à facturer (HTG)</Label>
              <Input
                type="number" step="1" placeholder={form.quoted_amount_htg || '12 000'}
                value={form.final_amount_htg}
                onChange={e => setForm(p => ({ ...p, final_amount_htg: e.target.value }))}
                className="rounded-xl"
              />
              {request.quoted_amount_htg && (
                <p className="text-[11px] text-muted-foreground">Devis initial : {fmt(request.quoted_amount_htg)} HTG</p>
              )}
            </div>
          )}

          {/* Admin notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Notes admin (internes)</Label>
            <textarea
              value={form.admin_notes}
              onChange={e => setForm(p => ({ ...p, admin_notes: e.target.value }))}
              rows={3}
              disabled={s === 'invoiced' || s === 'cancelled'}
              placeholder="Notes visibles seulement par l'admin…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none disabled:opacity-50"
            />
          </div>
        </div>

        <SheetFooter className="flex-col gap-2">
          {s === 'submitted' && (
            <>
              <Button
                className="w-full rounded-xl gap-2"
                onClick={handleMarkReviewing}
                disabled={saving}
                variant="outline"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
                Marquer en révision
              </Button>
              <Button
                className="w-full rounded-xl gap-2"
                onClick={handleSendQuote}
                disabled={saving}
                style={BTN_ORANGE}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Envoyer le devis
              </Button>
            </>
          )}
          {s === 'reviewing' && (
            <Button
              className="w-full rounded-xl gap-2"
              onClick={handleSendQuote}
              disabled={saving}
              style={BTN_ORANGE}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Envoyer le devis
            </Button>
          )}
          {(s === 'submitted' || s === 'reviewing' || s === 'quoted') && (
            <Button
              className="w-full rounded-xl gap-2"
              onClick={handleMarkReceived}
              disabled={saving}
              variant={s === 'quoted' ? 'default' : 'outline'}
              style={s === 'quoted' ? BTN_ORANGE : undefined}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}
              Marquer reçu en entrepôt
            </Button>
          )}
          {s === 'received' && (
            <Button
              className="w-full rounded-xl gap-2"
              onClick={handleInvoice}
              disabled={saving}
              style={BTN_ORANGE}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
              Facturer — débiter le portefeuille
            </Button>
          )}
          <Button variant="outline" className="w-full rounded-xl" onClick={onClose}>
            Fermer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Request card ──────────────────────────────────────────────────────────────

function RequestCard({ request, onAction }: { request: ShippingRequest; onAction: (r: ShippingRequest) => void }) {
  const [expanded, setExpanded] = useState(false)
  const s = request.status

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
          <Package className="h-4 w-4 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {request.profiles?.full_name ?? 'Client inconnu'}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {request.product_rate_category?.name ?? '—'} ·{' '}
            {request.warehouse?.flag_emoji} {request.warehouse?.code ?? '—'}
            {request.package_count != null && ` · ${request.package_count} colis`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', STATUS_COLORS[s] ?? 'bg-gray-100 text-gray-500 border-gray-200')}>
            {STATUS_LABELS[s] ?? s}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3.5 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">CBM estimé / réel</p>
              <p className="font-medium">
                {request.estimated_cbm != null ? `${request.estimated_cbm} m³` : '—'} / {request.actual_cbm != null ? `${request.actual_cbm} m³` : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Poids estimé / réel</p>
              <p className="font-medium">
                {request.estimated_kg != null ? `${request.estimated_kg} kg` : '—'} / {request.actual_kg != null ? `${request.actual_kg} kg` : '—'}
              </p>
            </div>
            {request.quoted_amount_htg != null && (
              <div>
                <p className="text-muted-foreground">Devis estimatif</p>
                <p className="font-medium">{fmt(request.quoted_amount_htg)} HTG</p>
              </div>
            )}
            {request.actual_amount_htg != null && (
              <div>
                <p className="text-muted-foreground">Montant facturé</p>
                <p className="font-medium text-emerald-600">{fmt(request.actual_amount_htg)} HTG</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="flex gap-4 text-[11px] text-muted-foreground flex-wrap">
            <span>Créé {fmtDate(request.created_at)}</span>
            {request.quoted_at && <span className="text-orange-600">Devis {fmtDate(request.quoted_at)}</span>}
            {request.received_at && <span className="text-indigo-600">Reçu {fmtDate(request.received_at)}</span>}
            {request.invoiced_at && <span className="text-emerald-600">Facturé {fmtDate(request.invoiced_at)}</span>}
          </div>

          {request.notes && (
            <p className="text-xs text-muted-foreground italic">Client : "{request.notes}"</p>
          )}
          {request.admin_notes && (
            <p className="text-xs text-orange-700 bg-orange-50 rounded-lg px-2.5 py-1.5">Admin : {request.admin_notes}</p>
          )}

          {s !== 'invoiced' && s !== 'cancelled' && (
            <Button
              size="sm"
              className="w-full rounded-xl mt-1 gap-2"
              style={BTN_ORANGE}
              onClick={() => onAction(request)}
            >
              <CheckCheck className="h-4 w-4" />
              Gérer cette demande
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type FilterTab = 'active' | 'submitted' | 'reviewing' | 'quoted' | 'received' | 'invoiced' | 'all'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'active',    label: 'Actives'       },
  { key: 'submitted', label: 'Soumises'      },
  { key: 'reviewing', label: 'En révision'   },
  { key: 'quoted',    label: 'Devis envoyé'  },
  { key: 'received',  label: 'Reçues'        },
  { key: 'invoiced',  label: 'Facturées'     },
  { key: 'all',       label: 'Toutes'        },
]

export function AdminShippingRequestsPage() {
  const [requests, setRequests] = useState<ShippingRequest[]>([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<FilterTab>('active')
  const [search,   setSearch]   = useState('')
  const [active,   setActive]   = useState<ShippingRequest | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('product_requests')
      .select(`
        id, status, notes, created_at, updated_at,
        estimated_cbm, estimated_kg, actual_cbm, actual_kg,
        quoted_amount_htg, actual_amount_htg,
        quoted_at, received_at, invoiced_at, package_count, admin_notes,
        user_id,
        profiles!product_requests_user_id_fkey(full_name, phone),
        warehouse:warehouses(id, code, name, flag_emoji, country_code),
        product_rate_category:product_rate_categories(id, name, slug, rate_multiplier)
      `)
      .eq('request_type', 'shipping')
      .order('created_at', { ascending: false })
    setLoading(false)
    if (error) { toast.error('Erreur chargement : ' + error.message); return }
    setRequests((data as ShippingRequest[]) ?? [])
  }

  useEffect(() => { load() }, [])

  function handleDone() {
    setActive(null)
    load()
  }

  const filtered = requests.filter(r => {
    if (tab === 'active')  return !['invoiced', 'cancelled'].includes(r.status)
    if (tab === 'all')     return true
    return r.status === tab
  }).filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.profiles?.full_name?.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.warehouse?.code?.toLowerCase().includes(q) ||
      r.product_rate_category?.slug?.toLowerCase().includes(q)
    )
  })

  const counts: Record<FilterTab, number> = {
    active:    requests.filter(r => !['invoiced', 'cancelled'].includes(r.status)).length,
    submitted: requests.filter(r => r.status === 'submitted').length,
    reviewing: requests.filter(r => r.status === 'reviewing').length,
    quoted:    requests.filter(r => r.status === 'quoted').length,
    received:  requests.filter(r => r.status === 'received').length,
    invoiced:  requests.filter(r => r.status === 'invoiced').length,
    all:       requests.length,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Demandes d'expédition</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gérez les devis, réceptions et facturations de fret
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={load}>
          <Warehouse className="h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Rechercher par client, ID, entrepôt…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="rounded-xl"
      />

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all',
              tab === key
                ? 'text-white shadow-sm'
                : 'bg-gray-100 text-muted-foreground hover:text-foreground'
            )}
            style={tab === key ? BTN_ORANGE : undefined}
          >
            {label}
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
              tab === key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
            )}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucune demande</p>
          <p className="text-sm mt-0.5">
            {search ? 'Aucun résultat pour cette recherche' : 'Pas de demandes dans cet onglet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <RequestCard key={r.id} request={r} onAction={setActive} />
          ))}
        </div>
      )}

      {active && (
        <AdminActionSheet
          request={active}
          onClose={() => setActive(null)}
          onDone={handleDone}
        />
      )}
    </div>
  )
}

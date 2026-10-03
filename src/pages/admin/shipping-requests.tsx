import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { shipmentStatusLabel } from '@/lib/cargo-tracking'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Package, Loader2, ChevronDown, ChevronUp,
  CheckCheck, FileText, Scale, Box, Ship, RefreshCw,
  Clock, CheckCircle2, AlertCircle, Calculator, Plane,
} from 'lucide-react'

import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'
interface ShippingRateOption {
  id: string
  mode: 'ocean' | 'air'
  name: string
  base_fee_usd: number
  per_cbm_usd: number | null
  per_kg_usd: number | null
}


interface ShipmentBatch {
  id: string
  batch_code: string
  status: string
  vessel_info: string | null
  estimated_arrival: string | null
}

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
  payment_due_at: string | null
  paid_amount_htg: number | null
  late_fee_htg: number | null
  package_count: number | null
  origin_country: string | null
  destination_address: string | null
  shipment_id: string | null
  admin_notes: string | null
  user_id: string
  shipment: { batch_code: string; status: string } | null
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
  submitted: tr('Soumis'),
  reviewing: tr('En révision'),
  quoted:    tr('Devis envoyé'),
  received:  tr('Reçu en entrepôt'),
  deposit_paid: tr('Acompte payé'),
  invoiced:  tr('Payé'),
  cancelled: tr('Annulé'),
}

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  reviewing: 'bg-sky-50 text-sky-700 border-sky-200',
  quoted:    'bg-orange-50 text-orange-700 border-orange-200',
  received:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  deposit_paid: 'bg-teal-50 text-teal-700 border-teal-200',
  invoiced:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

const BTN_ORANGE = { background: 'linear-gradient(135deg, #F05A28, #D44E21)', color: '#fff' }

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat(LOCALE_TAG).format(n)
}

function fmtDate(s: string | null | undefined) {
  if (!s) return null
  return new Date(s).toLocaleDateString(DATE_LOCALE, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
    actual_cbm:       String(request.actual_cbm ?? request.estimated_cbm ?? ''),
    actual_kg:        String(request.actual_kg  ?? request.estimated_kg  ?? ''),
    override_amount:  '',
    admin_notes:      request.admin_notes ?? '',
    selected_rate_id: '',
  })
  const [rates, setRates] = useState<ShippingRateOption[]>([])
  const [usdToHtg, setUsdToHtg] = useState(140)
  const [batches, setBatches] = useState<ShipmentBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string>(request.shipment_id ?? '')
  const [assigningSaving, setAssigningSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('shipping_rates')
        .select('id, mode, name, base_fee_usd, per_cbm_usd, per_kg_usd')
        .eq('active', true)
        .order('mode').order('sort_order'),
      supabase.from('app_settings').select('value').eq('key', 'usd_to_htg_rate').single(),
      supabase.from('shipments').select('id, batch_code, status, vessel_info, estimated_arrival')
        .not('status', 'eq', 'cancelled')
        .order('created_at', { ascending: false }),
    ]).then(([ratesRes, settingRes, batchesRes]) => {
      if (ratesRes.data) setRates(ratesRes.data as ShippingRateOption[])
      if (settingRes.data) setUsdToHtg(parseFloat(settingRes.data.value) || 140)
      if (batchesRes.data) setBatches(batchesRes.data as ShipmentBatch[])
    })
  }, [])

  // Auto-calculate HTG amount from selected rate + CBM/KG
  const calcResult = useMemo(() => {
    const rate = rates.find(r => r.id === form.selected_rate_id)
    if (!rate) return null
    const cbm = parseFloat(form.actual_cbm) || 0
    const kg  = parseFloat(form.actual_kg)  || 0
    const mult = request.product_rate_category?.rate_multiplier ?? 1
    const usd  = rate.base_fee_usd + (rate.per_cbm_usd ?? 0) * cbm + (rate.per_kg_usd ?? 0) * kg
    return { usd, htg: Math.round(usd * mult * usdToHtg) }
  }, [form.selected_rate_id, form.actual_cbm, form.actual_kg, rates, usdToHtg, request.product_rate_category])

  const finalAmount = form.override_amount
    ? parseFloat(form.override_amount)
    : calcResult?.htg ?? null

  async function handleAssignBatch() {
    setAssigningSaving(true)
    const { error } = await supabase
      .from('product_requests')
      .update({ shipment_id: selectedBatchId || null })
      .eq('id', request.id)
    setAssigningSaving(false)
    if (error) { toast.error(tr('Erreur : ') + error.message); return }
    toast.success(selectedBatchId ? tr('Cargaison assignée au batch') : tr('Assignation retirée'))
    onDone()
  }

  async function handleMarkReviewing() {
    setSaving(true)
    const { error } = await supabase.rpc('admin_mark_shipping_reviewing', {
      p_request_id: request.id,
    })
    setSaving(false)
    if (error) { toast.error(tr('Erreur : ') + error.message); return }
    toast.success(tr('Demande marquée en révision'))
    onDone()
  }

  async function handleSendQuote() {
    if (!form.actual_cbm || !form.actual_kg) {
      toast.error(tr('CBM réel et poids réel sont obligatoires'))
      return
    }
    if (!finalAmount) {
      toast.error(tr('Sélectionnez un tarif ou saisissez un montant de remplacement'))
      return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('admin_send_shipping_quote', {
      p_request_id:        request.id,
      p_actual_cbm:        parseFloat(form.actual_cbm),
      p_actual_kg:         parseFloat(form.actual_kg),
      p_quoted_amount_htg: finalAmount,
      p_quoted_rate_id:    form.selected_rate_id || null,
      p_admin_notes:       form.admin_notes || null,
    })
    setSaving(false)
    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? tr('Erreur'))
      return
    }
    toast.success(tr('Devis envoyé au client ✓'))
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
      toast.error(data?.error ?? error?.message ?? tr('Erreur'))
      return
    }
    toast.success(tr('Colis marqué reçu en entrepôt'))
    onDone()
  }

  async function handleCollectBalance() {
    setSaving(true)
    const { data, error } = await supabase.rpc('admin_collect_shipping_balance', {
      p_request_id: request.id,
      p_note:       form.admin_notes || null,
    })
    setSaving(false)
    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? tr('Erreur'))
      return
    }
    toast.success(tr('Solde de {0} HTG encaissé ✓', fmt(data.collected)))
    onDone()
  }

  const s = request.status
  const dueAt = request.payment_due_at ? new Date(request.payment_due_at) : null
  const lateDays = s === 'quoted' && dueAt && dueAt.getTime() < Date.now()
    ? Math.ceil((Date.now() - dueAt.getTime()) / 86_400_000) : 0
  const balanceRemaining = Math.max((request.quoted_amount_htg ?? 0) - (request.paid_amount_htg ?? 0), 0)
  const oceanRates = rates.filter(r => r.mode === 'ocean')
  const airRates   = rates.filter(r => r.mode === 'air')

  return (
    <Sheet open onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">
            {tr('Demande #')}{request.id.slice(0, 8).toUpperCase()}
          </SheetTitle>
        </SheetHeader>

        <div className="py-5 space-y-5">
          {/* Status banner */}
          {(s === 'submitted' || s === 'reviewing') && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3 flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-relaxed">
                {tr('En attente de réception — marquez les colis reçus à l\'entrepôt pour établir le devis.')}
              </p>
            </div>
          )}
          {s === 'received' && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-3.5 py-3 flex items-start gap-2.5">
              <Box className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-sm text-indigo-800 leading-relaxed">
                {tr('Colis reçus — saisissez les mesures réelles, choisissez le tarif et envoyez le devis.')}
              </p>
            </div>
          )}
          {s === 'quoted' && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 px-3.5 py-3 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
              <p className="text-sm text-orange-800 leading-relaxed">
                {tr('Devis envoyé — le client doit régler')}{' '}<span className="font-bold">{fmt(request.quoted_amount_htg)} HTG</span>
                {dueAt && <>{' '}{tr('avant le')}{' '}<span className="font-bold">{dueAt.toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })}</span></>}.
              </p>
            </div>
          )}
          {lateDays > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-3 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 leading-relaxed">
                {tr('En retard de')}{' '}<span className="font-bold">{lateDays}{' '}{tr('jour')}{lateDays > 1 ? 's' : ''}</span>{' '}{tr('— frais de retard courants :')}{' '}
                <span className="font-bold">{fmt(lateDays * 500)} HTG</span>{tr('. Ils sont ajoutés automatiquement au paiement du client.')}
              </p>
            </div>
          )}
          {s === 'deposit_paid' && (
            <div className="rounded-xl bg-teal-50 border border-teal-200 px-3.5 py-3 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
              <p className="text-sm text-teal-800 leading-relaxed">
                {tr('Acompte reçu :')}{' '}<span className="font-bold">{fmt(request.paid_amount_htg)} HTG</span>
                {(request.late_fee_htg ?? 0) > 0 && <> (+ {fmt(request.late_fee_htg)}{' '}{tr('HTG de frais de retard)')}</>}{tr('. Solde à encaisser à la livraison :')}{' '}<span className="font-bold">{fmt(balanceRemaining)} HTG</span>.
              </p>
            </div>
          )}
          {s === 'invoiced' && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-3 flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              <p className="text-sm text-emerald-800 font-medium">
                {tr('Paiement reçu —')}{' '}{fmt(request.actual_amount_htg ?? request.quoted_amount_htg)}{' '}{tr('HTG. Assignez au batch.')}
              </p>
            </div>
          )}

          {/* Client info */}
          <div className="rounded-xl bg-gray-50 p-3.5 space-y-1 text-sm">
            <p className="font-semibold">{request.profiles?.full_name ?? tr('Client inconnu')}</p>
            {request.profiles?.phone && <p className="text-muted-foreground">{request.profiles.phone}</p>}
            <p className="text-muted-foreground">
              {request.product_rate_category?.name ?? '—'} · {' '}
              {request.warehouse?.flag_emoji} {request.warehouse?.name ?? '—'}
            </p>
            {request.origin_country && (
              <p className="text-muted-foreground">
                {tr('Origine :')}{' '}{request.origin_country === 'CN' ? tr('🇨🇳 Chine') : request.origin_country === 'US' ? tr('🇺🇸 États-Unis') : request.origin_country}
              </p>
            )}
            <p className="text-muted-foreground">{tr('Créé le')}{' '}{fmtDate(request.created_at)}</p>
            {request.notes && <p className="text-muted-foreground italic">"{request.notes}"</p>}
          </div>

          {/* ── Mesures + calcul automatique (statut received) ── */}
          {(s === 'received' || s === 'quoted' || s === 'deposit_paid' || s === 'invoiced') && (
            <div className="space-y-4">
              <p className="text-sm font-semibold">{tr('Mesures réelles')}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tr('CBM réel (m³)')}</Label>
                  <Input
                    type="number" step="0.001" placeholder="0.500"
                    value={form.actual_cbm}
                    onChange={e => setForm(p => ({ ...p, actual_cbm: e.target.value }))}
                    className="rounded-xl"
                    disabled={s !== 'received'}
                  />
                  {request.estimated_cbm != null && (
                    <p className="text-[10px] text-muted-foreground">{tr('Estimé :')}{' '}{request.estimated_cbm} m³</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tr('Poids réel (kg)')}</Label>
                  <Input
                    type="number" step="0.1" placeholder="5.0"
                    value={form.actual_kg}
                    onChange={e => setForm(p => ({ ...p, actual_kg: e.target.value }))}
                    className="rounded-xl"
                    disabled={s !== 'received'}
                  />
                  {request.estimated_kg != null && (
                    <p className="text-[10px] text-muted-foreground">{tr('Estimé :')}{' '}{request.estimated_kg} kg</p>
                  )}
                </div>
              </div>

              {/* Tarif + calcul auto — seulement lors de la saisie du devis */}
              {s === 'received' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {tr('Tarif d\'expédition applicable')}
                    </Label>
                    <Select
                      value={form.selected_rate_id}
                      onValueChange={v => setForm(p => ({ ...p, selected_rate_id: v, override_amount: '' }))}
                    >
                      <SelectTrigger className="rounded-xl text-sm h-11">
                        <SelectValue placeholder={tr('Choisir un tarif…')} />
                      </SelectTrigger>
                      <SelectContent>
                        {oceanRates.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                              <Ship className="h-3 w-3" />{' '}{tr('Fret maritime')}
                            </div>
                            {oceanRates.map(r => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                                {r.per_cbm_usd != null && ` · $${r.per_cbm_usd}/m³`}
                                {r.per_kg_usd  != null && ` · $${r.per_kg_usd}/kg`}
                              </SelectItem>
                            ))}
                          </>
                        )}
                        {airRates.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mt-1">
                              <Plane className="h-3 w-3" />{' '}{tr('Fret aérien')}
                            </div>
                            {airRates.map(r => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                                {r.per_kg_usd != null && ` · $${r.per_kg_usd}/kg`}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Résultat du calcul automatique */}
                  {calcResult && (
                    <div className="rounded-xl bg-primary/6 border border-primary/20 p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <Calculator className="h-4 w-4 text-primary shrink-0" />
                        <p className="text-sm font-semibold text-primary">{tr('Montant calculé automatiquement')}</p>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-foreground">
                          {new Intl.NumberFormat(LOCALE_TAG).format(calcResult.htg)}
                        </p>
                        <p className="text-sm text-muted-foreground font-medium">HTG</p>
                        <span className="text-xs text-muted-foreground ml-auto">
                          ≈ ${calcResult.usd.toFixed(2)} USD × {usdToHtg} × ×{request.product_rate_category?.rate_multiplier ?? 1}
                        </span>
                      </div>
                      {form.override_amount && (
                        <p className="text-[11px] text-amber-600 mt-1">{tr('⚠ Montant de remplacement actif')}</p>
                      )}
                    </div>
                  )}

                  {/* Montant de remplacement (optionnel) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {tr('Montant de remplacement (HTG)')}{' '}<span className="font-normal italic">{tr('— optionnel, remplace le calcul')}</span>
                    </Label>
                    <Input
                      type="number" step="1" placeholder={calcResult ? String(calcResult.htg) : tr('ex. 15 000')}
                      value={form.override_amount}
                      onChange={e => setForm(p => ({ ...p, override_amount: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>

                  {/* Résumé final */}
                  {finalAmount != null && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 flex items-center justify-between">
                      <p className="text-sm font-semibold text-emerald-800">{tr('Devis à envoyer')}</p>
                      <p className="text-lg font-bold text-emerald-700">
                        {new Intl.NumberFormat(LOCALE_TAG).format(finalAmount)} HTG
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Affichage des montants déjà définis */}
              {(s === 'quoted' || s === 'deposit_paid' || s === 'invoiced') && (
                <div className="rounded-xl bg-orange-50 border border-orange-200 px-3.5 py-2.5 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{tr('Devis envoyé')}</p>
                  <p className="font-bold text-orange-700">{fmt(request.quoted_amount_htg)} HTG</p>
                </div>
              )}
            </div>
          )}

          {/* Admin notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{tr('Notes admin (internes)')}</Label>
            <textarea
              value={form.admin_notes}
              onChange={e => setForm(p => ({ ...p, admin_notes: e.target.value }))}
              rows={3}
              disabled={s === 'invoiced' || s === 'cancelled'}
              placeholder={tr('Notes visibles seulement par l\'admin…')}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none disabled:opacity-50"
            />
          </div>

          {/* Assign to shipment batch (shown once paid or deposit received) */}
          {(s === 'invoiced' || s === 'deposit_paid') && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <Ship className="h-4 w-4 text-indigo-600 shrink-0" />
                <p className="text-sm font-semibold text-indigo-800">{tr('Assigner à un batch d\'expédition')}</p>
              </div>
              {request.shipment_id && (
                <p className="text-[11px] text-indigo-700">
                  {tr('Actuellement dans :')}{' '}<span className="font-bold">{batches.find(b => b.id === request.shipment_id)?.batch_code ?? request.shipment_id.slice(0,8)}</span>
                </p>
              )}
              <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                <SelectTrigger className="rounded-xl bg-white border-indigo-200 text-sm">
                  <SelectValue placeholder={tr('Choisir un batch…')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{tr('— Aucun batch —')}</SelectItem>
                  {batches.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.batch_code} · {shipmentStatusLabel(b.status)}
                      {b.vessel_info ? ` · ${b.vessel_info}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="w-full rounded-xl gap-2"
                onClick={handleAssignBatch}
                disabled={assigningSaving || selectedBatchId === (request.shipment_id ?? '')}
                style={{ background: '#4F46E5', color: '#fff' }}
              >
                {assigningSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ship className="h-3.5 w-3.5" />}
                {selectedBatchId ? tr('Assigner au batch') : tr('Retirer du batch')}
              </Button>
            </div>
          )}
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
                {tr('Marquer en révision')}
              </Button>
              <Button
                className="w-full rounded-xl gap-2"
                onClick={handleMarkReceived}
                disabled={saving}
                style={BTN_ORANGE}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}
                {tr('Marquer reçu en entrepôt')}
              </Button>
            </>
          )}
          {s === 'reviewing' && (
            <Button
              className="w-full rounded-xl gap-2"
              onClick={handleMarkReceived}
              disabled={saving}
              style={BTN_ORANGE}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}
              {tr('Marquer reçu en entrepôt')}
            </Button>
          )}
          {s === 'received' && (
            <Button
              className="w-full rounded-xl gap-2"
              onClick={handleSendQuote}
              disabled={saving || !finalAmount}
              style={BTN_ORANGE}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {tr('Envoyer le devis —')}{' '}{finalAmount ? `${new Intl.NumberFormat(LOCALE_TAG).format(finalAmount)} HTG` : tr('saisir les données')}
            </Button>
          )}
          {s === 'deposit_paid' && (
            <Button
              className="w-full rounded-xl gap-2"
              onClick={handleCollectBalance}
              disabled={saving || balanceRemaining <= 0}
              style={BTN_ORANGE}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              {tr('Solde encaissé à la livraison —')}{' '}{fmt(balanceRemaining)} HTG
            </Button>
          )}
          <Button variant="outline" className="w-full rounded-xl" onClick={onClose}>
            {tr('Fermer')}
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
            {request.profiles?.full_name ?? tr('Client inconnu')}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {request.origin_country === 'CN' ? '🇨🇳' : request.origin_country === 'US' ? '🇺🇸' : ''}{' '}
            {request.product_rate_category?.name ?? '—'} ·{' '}
            {request.warehouse?.code ?? '—'}
            {request.package_count != null && tr(' · {0} colis', request.package_count)}
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
          <a href={`/admin/labels/${request.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold hover:bg-muted">
            {tr('Imprimer les étiquettes (QR)')}
          </a>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {request.origin_country && (
              <div>
                <p className="text-muted-foreground">{tr('Origine')}</p>
                <p className="font-medium">
                  {request.origin_country === 'CN' ? tr('🇨🇳 Chine') : request.origin_country === 'US' ? tr('🇺🇸 États-Unis') : request.origin_country}
                </p>
              </div>
            )}
            {request.destination_address && (
              <div>
                <p className="text-muted-foreground">{tr('Destination')}</p>
                <p className="font-medium">{request.destination_address}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">{tr('CBM estimé / réel')}</p>
              <p className="font-medium">
                {request.estimated_cbm != null ? `${request.estimated_cbm} m³` : '—'} / {request.actual_cbm != null ? `${request.actual_cbm} m³` : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{tr('Poids estimé / réel')}</p>
              <p className="font-medium">
                {request.estimated_kg != null ? `${request.estimated_kg} kg` : '—'} / {request.actual_kg != null ? `${request.actual_kg} kg` : '—'}
              </p>
            </div>
            {request.shipment && (
              <div>
                <p className="text-muted-foreground">{tr('Expédition (lot')}{' '}{request.shipment.batch_code})</p>
                <p className="font-medium text-sky-700">{shipmentStatusLabel(request.shipment.status)}</p>
              </div>
            )}
            {request.payment_due_at && (s === 'quoted' || s === 'received') && (
              <div>
                <p className="text-muted-foreground">{tr('Échéance de paiement')}</p>
                <p className={cn('font-medium', new Date(request.payment_due_at).getTime() < Date.now() && s === 'quoted' ? 'text-red-600' : '')}>
                  {new Date(request.payment_due_at).toLocaleDateString(DATE_LOCALE, { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}
            {s === 'deposit_paid' && (
              <div>
                <p className="text-muted-foreground">{tr('Solde à la livraison')}</p>
                <p className="font-medium text-teal-700">{fmt(Math.max((request.quoted_amount_htg ?? 0) - (request.paid_amount_htg ?? 0), 0))} HTG</p>
              </div>
            )}
            {request.quoted_amount_htg != null && (
              <div>
                <p className="text-muted-foreground">{tr('Devis estimatif')}</p>
                <p className="font-medium">{fmt(request.quoted_amount_htg)} HTG</p>
              </div>
            )}
            {request.actual_amount_htg != null && (
              <div>
                <p className="text-muted-foreground">{tr('Montant facturé')}</p>
                <p className="font-medium text-emerald-700">{fmt(request.actual_amount_htg)} HTG</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="flex gap-4 text-[11px] text-muted-foreground flex-wrap">
            <span>{tr('Créé')}{' '}{fmtDate(request.created_at)}</span>
            {request.quoted_at && <span className="text-orange-600">{tr('Devis')}{' '}{fmtDate(request.quoted_at)}</span>}
            {request.received_at && <span className="text-indigo-600">{tr('Reçu')}{' '}{fmtDate(request.received_at)}</span>}
            {request.invoiced_at && <span className="text-emerald-700">{tr('Payé')}{' '}{fmtDate(request.invoiced_at)}</span>}
          </div>

          {request.notes && (
            <p className="text-xs text-muted-foreground italic">{tr('Client : "')}{request.notes}"</p>
          )}
          {request.admin_notes && (
            <p className="text-xs text-orange-700 bg-orange-50 rounded-lg px-2.5 py-1.5">{tr('Admin :')}{' '}{request.admin_notes}</p>
          )}

          {s !== 'invoiced' && s !== 'cancelled' && (
            <Button
              size="sm"
              className="w-full rounded-xl mt-1 gap-2"
              style={BTN_ORANGE}
              onClick={() => onAction(request)}
            >
              <CheckCheck className="h-4 w-4" />
              {tr('Gérer cette demande')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type FilterTab = 'active' | 'submitted' | 'reviewing' | 'quoted' | 'received' | 'deposit_paid' | 'invoiced' | 'all'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'active',    label: tr('Actives')       },
  { key: 'submitted', label: tr('Soumises')      },
  { key: 'reviewing', label: tr('En révision')   },
  { key: 'quoted',    label: tr('Devis envoyé')  },
  { key: 'received',  label: tr('Reçues')        },
  { key: 'deposit_paid', label: tr('Acompte payé') },
  { key: 'invoiced',  label: tr('Payées')        },
  { key: 'all',       label: tr('Toutes')        },
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
        payment_due_at, paid_amount_htg, late_fee_htg,
        user_id,
        warehouse:warehouses(id, code, name, flag_emoji, country_code),
        product_rate_category:product_rate_categories(id, name, slug, rate_multiplier),
        shipment:shipments(batch_code, status)
      `)
      .eq('request_type', 'shipping')
      .order('created_at', { ascending: false })
    if (error) { setLoading(false); toast.error(tr('Erreur chargement : ') + error.message); return }

    const rows = data ?? []
    const userIds = [...new Set(rows.map((r: Record<string, unknown>) => r.user_id as string))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone')
      .in('user_id', userIds)
    const profileMap = Object.fromEntries(
      (profiles ?? []).map(p => [p.user_id, { full_name: p.full_name, phone: p.phone }])
    )

    setLoading(false)
    setRequests(rows.map((r: Record<string, unknown>) => ({
      ...r,
      profiles: profileMap[r.user_id as string] ?? null,
    })) as unknown as ShippingRequest[])
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
    deposit_paid: requests.filter(r => r.status === 'deposit_paid').length,
    invoiced:  requests.filter(r => r.status === 'invoiced').length,
    all:       requests.length,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr('Demandes d\'expédition')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('Gérez les devis, réceptions et facturations de fret')}
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={load}>
          <RefreshCw className="h-4 w-4" />
          {tr('Actualiser')}
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder={tr('Rechercher par client, ID, entrepôt…')}
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
          <p className="font-medium">{tr('Aucune demande')}</p>
          <p className="text-sm mt-0.5">
            {search ? tr('Aucun résultat pour cette recherche') : tr('Pas de demandes dans cet onglet')}
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

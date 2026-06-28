import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Loader2, Save, RefreshCw, DollarSign, Plane, Landmark, Percent, CreditCard, Eye, EyeOff, Link, Settings2, CheckCircle } from 'lucide-react'

interface Setting {
  key: string
  value: string
  label: string
  description: string | null
  updated_at: string
}

const SETTING_ICONS: Record<string, typeof DollarSign> = {
  usd_to_htg_rate:       DollarSign,
  freight_per_kg_usd:    Plane,
  duty_rate_percent:     Landmark,
  service_margin_percent: Percent,
}

const SETTING_SUFFIXES: Record<string, string> = {
  usd_to_htg_rate:       'HTG/USD',
  freight_per_kg_usd:    'USD/kg',
  duty_rate_percent:     '%',
  service_margin_percent: '%',
}

const PAYMENT_KEYS = ['payment_client_id', 'payment_client_secret', 'payment_return_url', 'payment_methods', 'payment_base_url']
const CALC_KEYS = ['usd_to_htg_rate', 'freight_per_kg_usd', 'duty_rate_percent', 'service_margin_percent']

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  async function loadSettings() {
    setLoading(true)
    const { data } = await supabase.from('app_settings').select('key, value, label, description, updated_at').order('key')
    if (data) {
      setSettings(data as Setting[])
      setValues(Object.fromEntries(data.map((s: Setting) => [s.key, s.value])))
    }
    setLoading(false)
  }

  useEffect(() => { loadSettings() }, [])

  async function handleSave() {
    setSaving(true)
    const calcSettings = settings.filter(s => CALC_KEYS.includes(s.key))
    const updates = calcSettings.map(s => ({
      key: s.key,
      value: values[s.key] ?? s.value,
      label: s.label,
      description: s.description,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' })
    if (error) toast.error('Erreur lors de la sauvegarde.')
    else { toast.success('Paramètres de calcul mis à jour.'); await loadSettings() }
    setSaving(false)
  }

  async function handleSavePayment() {
    setSavingPayment(true)
    const paySettings = settings.filter(s => PAYMENT_KEYS.includes(s.key))
    const updates = paySettings.map(s => ({
      key: s.key,
      value: values[s.key] ?? s.value,
      label: s.label,
      description: s.description,
      sensitive: s.key === 'payment_client_secret',
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' })
    if (error) toast.error('Erreur lors de la sauvegarde.')
    else { toast.success('Configuration API paiement enregistrée.'); await loadSettings() }
    setSavingPayment(false)
  }

  const calcSettings = settings.filter(s => CALC_KEYS.includes(s.key))
  const paymentSettings = settings.filter(s => PAYMENT_KEYS.includes(s.key))
  const hasCalcChanges = calcSettings.some(s => values[s.key] !== s.value)
  const hasPaymentChanges = paymentSettings.some(s => values[s.key] !== s.value)
  const hasChanges = hasCalcChanges

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configurez les taux et marges utilisés dans les estimations clients</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !hasChanges} className="rounded-xl gap-2 shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </Button>
      </div>

      {/* ── Payment API settings ── */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
              <CreditCard className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">API Paiement (PLOP PLOP)</p>
              <p className="text-xs text-muted-foreground">Clés MonCash & NatCash — configuration sécurisée</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <img src="/moncash-logo.jpg" alt="MonCash" className="h-5 object-contain rounded" />
            <img src="/natcash-logo.png" alt="NatCash" className="h-5 object-contain" />
          </div>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : (
            <>
              {/* Client ID */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Settings2 className="h-3.5 w-3.5" /> Client ID
                </Label>
                <p className="text-[11px] text-muted-foreground">Identifiant marchand PLOP PLOP (format : pp_...)</p>
                <Input
                  value={values['payment_client_id'] ?? ''}
                  onChange={e => setValues(p => ({ ...p, payment_client_id: e.target.value }))}
                  placeholder="pp_d6d7ffd9450cbc8da8fe622c13fb"
                  className="font-mono text-sm rounded-xl"
                />
              </div>

              {/* Client Secret */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Clé Privée (Hash 64 chars)
                </Label>
                <p className="text-[11px] text-muted-foreground">Clé secrète HMAC — ne jamais partager, invisible aux clients</p>
                <div className="relative">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    value={values['payment_client_secret'] ?? ''}
                    onChange={e => setValues(p => ({ ...p, payment_client_secret: e.target.value }))}
                    placeholder="c4e6b79760e3bb1d0134a4832f557c9e45944b7bb7edf37ef228a4b3faa42325"
                    className="font-mono text-sm rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Return URL */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Link className="h-3.5 w-3.5" /> URL de retour
                </Label>
                <p className="text-[11px] text-muted-foreground">URL de votre site où PLOP PLOP redirige après paiement</p>
                <Input
                  value={values['payment_return_url'] ?? ''}
                  onChange={e => setValues(p => ({ ...p, payment_return_url: e.target.value }))}
                  placeholder="https://konvwa.app/payment/return"
                  className="text-sm rounded-xl"
                />
              </div>

              {/* Methods */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" /> Méthodes actives
                </Label>
                <Input
                  value={values['payment_methods'] ?? 'moncash,natcash'}
                  onChange={e => setValues(p => ({ ...p, payment_methods: e.target.value }))}
                  placeholder="moncash,natcash"
                  className="text-sm rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">Valeurs possibles : moncash · natcash · moncash,natcash · all</p>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleSavePayment}
                  disabled={savingPayment || !hasPaymentChanges}
                  className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {savingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer l'API paiement
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Calculation parameters */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Paramètres de calcul</p>
            <p className="text-xs text-muted-foreground">Ces valeurs s'appliquent en temps réel dans le calculateur de soumission</p>
          </div>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-5">
              {calcSettings.map(setting => {
                const Icon = SETTING_ICONS[setting.key] || DollarSign
                const suffix = SETTING_SUFFIXES[setting.key] || ''
                const step = setting.key.includes('percent') ? '0.5' : '0.5'
                return (
                  <div key={setting.key} className="space-y-2">
                    <Label className="flex items-center gap-2 font-semibold text-sm">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      {setting.label}
                    </Label>
                    {setting.description && (
                      <p className="text-xs text-muted-foreground">{setting.description}</p>
                    )}
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        step={step}
                        value={values[setting.key] ?? setting.value}
                        onChange={e => setValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                        className="pr-20 font-mono rounded-xl"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                        {suffix}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70">
                      Dernière mise à jour : {new Date(setting.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      {!loading && settings.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">Aperçu d'une commande exemple</p>
              <p className="text-xs text-muted-foreground">50 unités à $4.50/u · 0.25 kg/u avec les paramètres actuels</p>
            </div>
          </div>
          <div className="p-5">
            {(() => {
              const rate = parseFloat(values['usd_to_htg_rate'] || '132')
              const freight = parseFloat(values['freight_per_kg_usd'] || '11')
              const duty = parseFloat(values['duty_rate_percent'] || '20')
              const svc = parseFloat(values['service_margin_percent'] || '15')
              const qty = 50, price = 4.5, weight = 0.25
              const productUSD = price * qty
              const freightUSD = weight * qty * freight
              const cif = productUSD + freightUSD
              const dutyUSD = cif * (duty / 100)
              const subtotal = productUSD + freightUSD + dutyUSD
              const serviceUSD = subtotal * (svc / 100)
              const totalUSD = subtotal + serviceUSD
              const totalHTG = totalUSD * rate
              const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR')
              const fmtU = (n: number) => '$' + n.toFixed(2)
              return (
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2.5">
                    {[
                      { label: 'Produit (50 × $4.50)', value: fmtU(productUSD) },
                      { label: `Fret (12.5 kg × $${freight}/kg)`, value: `+ ${fmtU(freightUSD)}` },
                      { label: `Douane (${duty}% CIF)`, value: `+ ${fmtU(dutyUSD)}` },
                      { label: `Service (${svc}%)`, value: `+ ${fmtU(serviceUSD)}` },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-mono font-semibold">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total rendu</p>
                    <p className="text-3xl font-bold font-mono text-primary">{fmt(totalHTG)}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">HTG</p>
                    <p className="text-xs text-muted-foreground font-mono mt-2">≈ {fmtU(totalUSD)}</p>
                    <div className="mt-3 pt-3 border-t border-primary/20">
                      <p className="text-xs text-muted-foreground">{fmt(totalHTG / qty)} HTG / unité</p>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {hasChanges && (
        <div className="sticky bottom-4 flex justify-center">
          <Button onClick={handleSave} disabled={saving} className="shadow-lg gap-2 rounded-full px-6">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer les modifications
          </Button>
        </div>
      )}
    </div>
  )
}

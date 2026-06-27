import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Loader2, Save, RefreshCw, DollarSign, Plane, Landmark, Percent } from 'lucide-react'

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

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
    const updates = settings.map(s => ({
      key: s.key,
      value: values[s.key] ?? s.value,
      label: s.label,
      description: s.description,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' })
    if (error) {
      toast.error('Erreur lors de la sauvegarde.')
    } else {
      toast.success('Paramètres mis à jour.')
      await loadSettings()
    }
    setSaving(false)
  }

  const hasChanges = settings.some(s => values[s.key] !== s.value)

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
              {settings.map(setting => {
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

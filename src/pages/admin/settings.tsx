import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
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
  usd_to_htg_rate: DollarSign,
  freight_per_kg_usd: Plane,
  duty_rate_percent: Landmark,
  service_margin_percent: Percent,
}

const SETTING_SUFFIXES: Record<string, string> = {
  usd_to_htg_rate: 'HTG/USD',
  freight_per_kg_usd: 'USD/kg',
  duty_rate_percent: '%',
  service_margin_percent: '%',
}

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function loadSettings() {
    setLoading(true)
    const { data } = await supabase
      .from('app_settings')
      .select('key, value, label, description, updated_at')
      .order('key')

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
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Paramètres"
          description="Configurez les taux et marges utilisés dans les estimations clients"
        />
        <Button onClick={handleSave} disabled={saving || !hasChanges} className="gap-2 shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </Button>
      </div>

      {/* Calculation parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Paramètres de calcul
          </CardTitle>
          <CardDescription>
            Ces valeurs s'appliquent en temps réel dans le calculateur de soumission des commandes clients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-5">
              {settings.map(setting => {
                const Icon = SETTING_ICONS[setting.key] || DollarSign
                const suffix = SETTING_SUFFIXES[setting.key] || ''
                const step = setting.key.includes('percent') ? '0.5' : '0.5'
                return (
                  <div key={setting.key} className="space-y-2">
                    <Label className="flex items-center gap-2">
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
                        className="pr-16 font-mono"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                        {suffix}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70">
                      Dernière mise à jour : {new Date(setting.updated_at).toLocaleDateString('fr-HT', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {!loading && settings.length > 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Aperçu d'une commande exemple
            </CardTitle>
            <CardDescription>
              Basé sur 50 unités à $4.50/u · 0.25 kg/u avec les paramètres actuels
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Produit (50 × $4.50)</span>
                      <span className="font-mono">{fmtU(productUSD)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fret (12.5 kg × ${freight}/kg)</span>
                      <span className="font-mono">+ {fmtU(freightUSD)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Douane ({duty}% CIF)</span>
                      <span className="font-mono">+ {fmtU(dutyUSD)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service ({svc}%)</span>
                      <span className="font-mono">+ {fmtU(serviceUSD)}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total rendu</p>
                    <p className="text-2xl font-bold font-mono text-primary">{fmt(totalHTG)} <span className="text-sm font-normal text-muted-foreground">HTG</span></p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">≈ {fmtU(totalUSD)}</p>
                    <p className="text-xs text-muted-foreground mt-2">{fmt(totalHTG / qty)} HTG / unité</p>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
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
